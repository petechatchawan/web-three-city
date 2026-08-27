# Simulation Time System

**Status:** PR #83 temporal authority and T1–T3B are merged on `master`; T4 — Compressed Calendar Projection + Playback Preservation is implemented on `feat/t4-compressed-calendar-projection` and is in final verification. T5–T7 remain not started. Temporal Authority & Simulation Clock Standard v1 remains the approved successor design from planning PR #94.
**Primary ownership:** `packages/simulation-core`, `apps/game/src/simulation-runtime.ts`, temporal Game orchestration, and time/calendar presentation.  
**Current persistence:** `SimulationSaveV3` inside `WorldSaveV8`; successor targets `SimulationSaveV4` inside `WorldSaveV9`.

## Purpose

Own deterministic in-game time, calendar projection, minute planning/commit, playback request policy, and sequencing state used by temporal consumers. Domain-specific Building, RCI, Economy, Mobility, and Traffic policies stay in their owner packages.

## Merged Authority Today

- `absoluteGameMinute` is the one persisted Simulation time authority.
- The T4 projection is `24 hours/cycle = 1 calendar month`, `12 months/year`, with no canonical calendar day; the clock remains `HH:mm`.
- Current nominal playback remains Pause / x1 / x2 / x4 with `1000ms` base and multipliers `1/2/4`.
- `macroHourIndex = floor(absoluteGameMinute / 60)` is the compatibility projection used by Building/RCI/Economy.
- Building Growth evaluates at `00/06/12/18`; RCI/Economy cycle work crosses the existing `08:00` boundary.
- Traffic owns a subordinate four-quanta-per-GameMinute cursor.
- Automatic runtime advances one temporal minute as five ordered authority phases:

```text
GameMinute -> Q1 -> Q2 -> Q3 -> Q4
```

The complete candidate chain is validated before internal batch publication. Success exposes only the final world and advances world revision exactly `+5`; rejection leaves the original world/minute/revision unchanged, pauses playback, clears accumulated real time, exposes a typed failure, and never silently retries.

## T1 Implementation on This Branch

`simulation-core` now exports validated, integer-backed opaque scalar types for `AbsoluteGameMinute`, `GameMinuteDuration`, `MacroHourIndex`, and `MacroHourDuration`, together with named value, addition, and comparison helpers. `SimulationSnapshot.absoluteGameMinute` and simulation minute/macro-hour transition contracts use the explicit types internally; V3 serialization and all legacy calendar values remain unchanged.

The application and directly affected Building/RCI boundary adapters use the named temporal helpers without migrating their domain field semantics. A TypeScript compiler-API architecture test scans production source for incompatible temporal operators and direct/escape casts, and runs as part of `pnpm test:deployment`.

T1 does not introduce the compressed calendar, playback changes, domain lifecycle renames, Save V9, or a new temporal package. Those remain owned by the approved T2–T7 execution order below. See the [T1 verification record](verification/2026-08-26-t1-explicit-temporal-units.md) for exact local evidence.

## T4 Implementation on This Branch

T4 projects the unchanged `AbsoluteGameMinute` authority through the
versioned compressed calendar policy:

```text
60 GameMinutes = 1 GameHour
24 GameHours   = 1 Simulation Cycle = 1 Calendar Month
12 Months      = 1 Calendar Year
```

`GameCalendar` exposes `year`, `month`, `hour`, and `minute`; the legacy
calendar `day` is no longer part of the canonical projection. Operational
cycle consumers continue to run on their existing 24-hour boundaries, and
WorldSaveV8 still stores the same numeric `absoluteGameMinute` value.

T4 preserves the merged playback request policy exactly:

```text
x1 = 1.000s / GameMinute
x2 = 0.500s / GameMinute
x4 = 0.250s / GameMinute
```

The five-phase temporal transaction remains
`GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, with successful revision delta `+5`.

## Approved Successor Direction

The approved successor keeps the same single authority and five-phase topology but introduces explicit temporal point/duration types and a versioned compressed calendar:

```text
60 GameMinutes = 1 GameHour
24 GameHours   = 1 Simulation Cycle = 1 Calendar Month
12 Months      = 1 Calendar Year
```

Playback during this migration **retains current merged pacing**:

```text
x1 = 1.000s / GameMinute
x2 = 0.500s / GameMinute
x4 = 0.250s / GameMinute
```

The older 3.0/1.5/0.75 proposal is superseded.

`AbsoluteGameMinute` remains 1:1 when V8 cities migrate to V9. Legacy calendar labels are reprojected under the compressed policy. RCI age-origin state receives an explicit age-preserving migration so the shorter 12-cycle year does not make existing citizens approximately 30x older.

## Ownership Boundaries

`simulation-core` owns:

- `AbsoluteGameMinute` / `GameMinuteDuration`;
- `MacroHourIndex` / `MacroHourDuration`;
- macro-hour/cycle/calendar projection and checked arithmetic;
- Simulation snapshot mutation/serialization contracts.

Traffic owns `AbsoluteTransportSecond` / `TransportSecondDuration` while consuming `AbsoluteGameMinute` one-way. `simulation-core` must never import Traffic, Mobility, Economy, Building, RCI, presentation, or app code.

`apps/game` owns cross-domain staging, atomic publication, playback state, and final UI/presentation integration.

## Approved Migration Order

```text
T1  Explicit Temporal Units + architecture enforcement       (merged)
T2A Building macro-hour migration                            (merged)
T2B RCI temporal/calendar migration                          (merged)
T2C Economy temporal migration                                (merged)
T3A Mobility temporal migration                               (merged)
T3B Traffic temporal migration                                (merged)
T4  Compressed calendar + unchanged playback                  (this branch)
T5  WorldSaveV9 + V1-V8 golden migration
T6  Game/UI/release cutover
T7  Legacy runtime naming/facade cleanup
```

Each slice uses local RED -> GREEN before any remote push. CI is exact-head independent verification, not the first debugger.

## Persistence

Current `SimulationSaveV3` stores revision, `absoluteGameMinute`, and Growth sequence. Legacy Simulation V1/V2 `absoluteTick` values are hourly and migrate with checked `*60`.

The successor targets V9 reader/writer semantics:

- V1–V9 readable;
- V9 writer only after T5;
- `temporalStandardVersion = 1`;
- `calendarPolicyVersion = 1`;
- raw historical numbers are converted only at trusted codec/migration boundaries.

## Handoff

Read in this order before successor implementation:

1. [Approved Temporal Authority & Simulation Clock Standard v1](specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md)
2. [Successor Execution Index](tdd/2026-08-26-temporal-successor-execution-index.md)
3. [ADR-0002 — Atomic Temporal Minute Publication](adrs/0002-atomic-temporal-minute-publication.md)
4. [ADR-0003 — Explicit Temporal Units](adrs/0003-explicit-temporal-units.md)
5. [ADR-0005 — Compressed Calendar and Playback Cutover](adrs/0005-compressed-calendar-playback-cutover.md)
6. [World ADR-0002 — WorldSaveV9 Temporal and Calendar Policy Migration](../world/adrs/0002-world-save-v9-calendar-policy-migration.md)

System-specific TDD plans live under each `docs/systems/<system>/tdd/` directory. PR #83 plans/ADR-0004/World ADR-0001 remain historical evidence and are not successor implementation authority.
