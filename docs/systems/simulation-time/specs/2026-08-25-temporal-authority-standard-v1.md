# Temporal Authority Standard v1 — Design Specification

**Status:** Approved — phased implementation
**System:** `simulation-time`
**Date:** `2026-08-25`

## Decision Summary

`SimulationSnapshot.absoluteGameMinute` remains the one persisted world-calendar
authority. Building, RCI, and Economy consume a derived macro-hour projection;
Mobility consumes game minutes; Traffic consumes a subordinate transport cursor.
No subsystem may introduce a second mutable world clock.

Delivery is deliberately split:

1. PR #83 fixes the observed Building lifecycle unit mismatch, makes one temporal
   minute externally atomic, and turns silent rejection into an explicit paused
   failure. It does not change calendar mapping, playback pacing, or Save schema.
2. A successor introduces explicit runtime temporal units and `WorldSaveV9`
   while preserving current gameplay semantics and V1–V8 compatibility.
3. A separate product milestone may adopt a compressed calendar and revised
   playback pacing only after RCI, Economy, migration, performance, and owner UX
   policy are approved together.

## Context

The minute migration retained legacy macro-hour lifecycle values in Building,
RCI, and Economy. At least three consumers lost that semantic boundary:

- complete-world validation compares a Building completion macro hour with
  `absoluteGameMinute`;
- Building presentation derives progress from `absoluteGameMinute`;
- legacy world-load lifecycle validation repeats the cross-unit comparison.

When valid Growth starts construction at a development boundary such as
`11:59 -> 12:00` or `23:59 -> 00:00`, the candidate is interpreted as already
overdue and rejected. The temporal controller collapses detailed planning errors
to `world:invalid-candidate`, returns the unchanged world, and leaves playback
active, causing an invisible retry loop at the same minute.

The current runtime also commits `GameMinute`, Q1, Q2, Q3, and Q4 directly to the
live store before final publication. External subscribers see only the final
world, but a later quantum rejection could leave a partially advanced internal
batch. PR #83 closes both failure modes without weakening five-phase authority.

## Goals

- Valid automatic Growth crosses every hour boundary without freezing time.
- Building lifecycle semantics are owned and evaluated only by `building-core`.
- One temporal minute is five validated transitions and one externally atomic
  publication with final world revision exactly `+5`.
- Rejection preserves the original world, pauses playback, exposes a typed
  reason once, and never retries automatically.
- Runtime and persistence units become explicit in a successor without changing
  the values represented by existing saves.
- Calendar and playback product changes remain independently reviewable.

## Non-Goals

- Disabling automatic Growth, skipping development boundaries, or converting a
  valid Growth attempt into a no-op.
- Reducing Traffic quanta, spreading authority across animation frames, or
  changing Traffic physical semantics.
- Changing PR #83 from the current one-real-second-per-game-minute pacing.
- Adopting the proposed compressed calendar in PR #83 or WorldSaveV9.
- Adding seasons, offline progress, a general scheduler, or catch-up simulation.
- Using slower pacing to mask performance or owner-visual failures.

## System Boundary

```text
real elapsed time
  -> playback accumulator (apps/game runtime only)
  -> request one temporal minute
  -> AbsoluteGameMinute (simulation-core authority)
       -> calendar projection
       -> MacroHourIndex (Building/RCI/Economy schedule)
       -> GameMinute schedule (Mobility)
       -> Transport cursor (Traffic; four quanta per minute)
  -> five validated world candidates
  -> one externally visible final world
```

`simulation-core` owns calendar arithmetic and transitions. Domain packages own
their policies. `apps/game` owns cross-domain staging, validation, publication,
playback state, and user-facing failure mapping. Presentation receives committed
state only.

## Authoritative and Derived State

Authoritative:

- `absoluteGameMinute`, Simulation revision, and Growth sequence;
- Building/RCI/Economy/Mobility/Traffic snapshots;
- Traffic V2 transport cursor subordinate to the game minute;
- committed world revision.

Derived:

- calendar labels and clock-of-day;
- macro-hour transition and all due-boundary predicates;
- construction progress and visual phase;
- playback accumulator and selected speed;
- presentation interpolation and temporal failure UI copy.

No derived calendar field is persisted as a competing cursor.

## Main Workflows

### Phase 1 temporal minute

1. Read one immutable original committed world at revision `R`.
2. Plan and fully validate the GameMinute candidate at `R+1`.
3. Plan and fully validate Q1–Q4 in order at `R+2..R+5`, each against the
   previous staged candidate.
4. Buffer phase receipts. Do not notify subscribers, mutate presentation, write
   external state, or invoke analytics while staging.
5. If any phase rejects, discard the candidate chain and return the original
   world at `R`.
6. If all phases pass, synchronously install the five prepared candidates inside
   one store critical section with no callback or asynchronous boundary.
7. Synchronize final dynamic/full presentation once, expose the final world, and
   notify committed-world subscribers once.

The five prepared transitions remain authority commits for revision and receipt
semantics. The live-store operation is externally atomic because the complete
chain is validated before mutation and no observer can run between installations.

### Failure workflow

`TemporalAdvanceResult` is a discriminated union:

```ts
type TemporalPhase = 'game-minute' | 'quantum-1' | 'quantum-2' | 'quantum-3' | 'quantum-4';

type TemporalAdvanceResult =
  | Readonly<{
      status: 'committed';
      world: CommittedWorld;
      beforeGameMinute: number;
      afterGameMinute: number;
      beforeRevision: number;
      afterRevision: number;
      phaseReceipts: readonly [
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
      ];
    }>
  | Readonly<{
      status: 'rejected';
      world: CommittedWorld;
      phase: TemporalPhase;
      reason: TemporalAdvanceRejection;
      beforeGameMinute: number;
      beforeRevision: number;
    }>;
```

On rejection, the Game runtime transitions to
`{ kind: 'paused-world-rejected', failure }`, clears accumulated real time,
updates the speed controls to Paused, presents bounded status text, and emits one
structured console diagnostic. It does not retry until an explicit resume,
manual step, load/reset, or world modification requests another attempt.

### Step contracts

- `step()` succeeds only when one minute commits, all five receipts exist, and
  the final revision is exactly `before + 5`.
- `stepMinutes(n)` is atomic per minute, not across the entire request. It stops
  at the first rejection and reports the number already committed plus the
  rejected minute, phase, and reason.

## Data and Contracts

### Phase 1 Building lifecycle seam

Until the explicit-unit successor renames fields, raw legacy lifecycle timestamp
properties are consumed only inside `building-core`. The package exports:

```ts
validateBuildingLifecycleAtMacroHour(instance, macroHourIndex): void
deriveConstructionStateAtMacroHour(instance, macroHourIndex): 'construction' | 'active'
deriveConstructionProgressAtMacroHour(instance, macroHourIndex): number
```

World validation, Save validation, and `building-three` use these APIs. They do
not compare `constructionCompletesAtTick` directly.

### Phase 2 explicit units

The successor introduces:

- `AbsoluteGameMinute`, `GameMinuteDuration`;
- `MacroHourIndex`, `MacroHourDuration`;
- `AbsoluteTransportSecond`, `TransportSecondDuration`.

Temporal constructors validate non-negative safe integers. Conversion,
arithmetic, and comparison flow through owning helpers. Architecture tests reject
cross-unit operators, raw branded casts, and `as unknown as` temporal escapes.

Runtime names become semantic (`constructionCompletesAtMacroHourIndex`,
`bornAtMacroHourIndex`, `departureGameMinute`,
`arrivedAtTransportSecond`). Mobility, Traffic, and Economy may depend on
`simulation-core`; the reverse dependency is forbidden.

## Persistence and Migration

Phase 1 keeps the V8 writer and fixes lifecycle validation through Building's
macro-hour API.

Phase 2 produces `SimulationSaveV4`, `BuildingSaveV3`, `RciSaveV2`,
`EconomySaveV2`, `MobilitySaveV3`, `TrafficSaveV3`, and `WorldSaveV9`. The V9
envelope carries one temporal-standard discriminator and explicit integer field
names; individual high-cardinality RCI timestamps are not wrapped in `{value,
unit}` objects.

Reader authority remains V1–V9; writer authority becomes V9. Migration rules:

- Simulation V1/V2 `absoluteTick` is an hourly cursor and migrates to game
  minutes with the existing checked `*60` conversion.
- Building, RCI, and Economy legacy `*Tick` fields already mean macro hours and
  migrate 1:1. They are never multiplied by 60.
- Mobility game-minute and Traffic transport-second values migrate 1:1.
- Invalid unit discriminators or unsafe integers reject the entire Save.

Golden historical fixtures must establish these meanings before V9 production
editing begins.

## Determinism and Performance

- Phase ordering remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`.
- Successful minute revision delta remains exactly `+5`.
- External subscriber notification and final presentation remain exactly once.
- Temporal batch staging is synchronous and contains no wall-clock reads.
- Typed units and V9 must not add per-frame work or per-RCI-record wrapper
  allocation.
- PR #83 retains current pacing and existing performance authority rules.

## Deferred Calendar and Playback Standard

The proposed product model is `60 minutes/hour`, `24 hours/calendar month`, and
`12 months/year`, with proposed real-time pacing of 3.0/1.5/0.75 seconds per game
minute at x1/x2/x4. It is not active repository authority.

Before acceptance, the milestone must specify and verify RCI aging, fertility,
mortality, Economy settlement/period closure, existing-Save date continuity,
HUD removal or reinterpretation of day, performance cadence, and owner UX. A
calendar mapping change requires a calendar-policy version or a later world-save
schema; V9 saves are not silently reinterpreted.

Traffic Q1–Q4 remain authority phases inside one atomic minute. Any 0.75-second
subinterval is presentation interpolation, never a wall-clock authority commit.

## Acceptance Criteria

- Every `HH:59 -> HH+1:00` transition commits or returns a typed rejection.
- Valid Growth starts at `00`, `06`, `12`, and `18` without freezing.
- No eligible placement is a successful no-op.
- Construction lifecycle and presentation use macro-hour semantics.
- A failed phase leaves minute, revision, world, presentation, and subscriber
  state unchanged.
- A successful minute has five ordered receipts, minute `+1`, revision `+5`,
  final presentation `1`, and subscriber notification `1`.
- Rejection pauses once and never automatically retries.
- Save/load at `N:59` continues through `N+1:00` identically to uninterrupted
  execution.
- PR #83 calendar, pacing, Traffic authority, and Save schema remain unchanged.

## PR Decomposition

1. PR #83: lifecycle correctness, atomic minute staging, typed result, fail-stop,
   regression and release closure.
2. Successor: explicit temporal units, dependency policy, all domain codecs, and
   WorldSaveV9.
3. Product milestone: compressed calendar and playback pacing after separate
   approval.

## Related Documents

- System overview: [Simulation Time](../README.md)
- Phase 1 ADR: [Atomic temporal minute publication](../adrs/0002-atomic-temporal-minute-publication.md)
- Phase 2 ADR: [Explicit temporal units](../adrs/0003-explicit-temporal-units.md)
- Deferred product ADR: [Simulation calendar and playback](../adrs/0004-simulation-calendar-playback-standard.md)
- Save ADR: [WorldSaveV9 temporal migration](../../world/adrs/0001-world-save-v9-temporal-unit-migration.md)
- Execution index: [Temporal authority execution index](../tdd/2026-08-25-temporal-authority-execution-index.md)
