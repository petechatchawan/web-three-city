# Simulation Time System

**Status:** PR #83, T1–T3B, and T4 — Compressed Calendar Projection are merged on `master@d170a473205bc080bdd70c31fd21ac868c8a7118`. T4.1 — Playback Scheduler vNext is the current implementation slice on `feat/t4-1-playback-scheduler-vnext`; T5–T7 remain not started. Temporal Authority & Simulation Clock Standard v1 remains the approved successor design from planning PR #94.
**Primary ownership:** `packages/simulation-core`, `apps/game/src/simulation-runtime.ts`, temporal Game orchestration, and time/calendar presentation.  
**Current persistence:** `SimulationSaveV3` inside `WorldSaveV8`; successor targets `SimulationSaveV4` inside `WorldSaveV9`.

## Purpose

Own deterministic in-game time, calendar projection, minute planning/commit, playback request policy, and sequencing state used by temporal consumers. Domain-specific Building, RCI, Economy, Mobility, and Traffic policies stay in their owner packages.

## Merged Authority Today

- `absoluteGameMinute` is the one persisted Simulation time authority.
- The T4 projection is `24 hours/cycle = 1 calendar month`, `12 months/year`, with no canonical calendar day; the clock remains `HH:mm`.
- Current playback is Pause / x1 / x2 / x4 at `0/2/4/8` GameMinutes per real second (`500/250/125ms` per GameMinute for x1/x2/x4).
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

## T4 Implementation (merged before T4.1)

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

T4 preserved the playback request policy that was merged at that time:

```text
x1 = 1.000s / GameMinute
x2 = 0.500s / GameMinute
x4 = 0.250s / GameMinute
```

The five-phase temporal transaction remains
`GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, with successful revision delta `+5`.

## T4.1 Playback Scheduler vNext

T4.1 supersedes only the real-time playback throughput portion of T4. The
calendar, `AbsoluteGameMinute` authority, domain cadence, and transaction
topology remain unchanged:

```text
Pause  = 0 GameMinutes / real second
x1     = 2 GameMinutes / real second = 500ms / GameMinute
x2     = 4 GameMinutes / real second = 250ms / GameMinute
x4     = 8 GameMinutes / real second = 125ms / GameMinute
```

The scheduler still requests one complete authoritative minute at a time.
Each request executes `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`; playback never
jumps over intermediate minutes. `advance()` processes at most eight minutes
per call and retains surplus real-time budget for later calls. A rejected
minute stops the current call, preserves earlier committed minutes, clears
the backlog, pauses playback, and does not retry automatically.

The UI labels remain Pause / Play / 2× / 4×. These are relative playback
presets, not absolute GameMinutes-per-second labels. See
[ADR-0006](adrs/0006-playback-scheduler-vnext.md) and the
[T4.1 verification plan](tdd/2026-08-27-playback-scheduler-vnext.md).

## Approved Successor Direction

The approved successor keeps the same single authority and five-phase topology but introduces explicit temporal point/duration types and a versioned compressed calendar:

```text
60 GameMinutes = 1 GameHour
24 GameHours   = 1 Simulation Cycle = 1 Calendar Month
12 Months      = 1 Calendar Year
```

Playback during the initial T4 calendar migration retained the merged
nominal pacing. T4.1 now defines the active scheduler throughput:

```text
x1 = 0.500s / GameMinute
x2 = 0.250s / GameMinute
x4 = 0.125s / GameMinute
```

The older 3.0/1.5/0.75 proposal remains rejected. T4.1 changes only
wall-clock scheduler throughput and does not change game-time durations or
domain cadence.

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
T4  Compressed calendar + initial playback policy               (merged)
T4.1 Playback Scheduler vNext                                  (current)
T5  WorldSaveV9 + V1-V8 golden migration                       (blocked on T4.1)
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
6. [ADR-0006 — Playback Scheduler vNext](adrs/0006-playback-scheduler-vnext.md)
7. [T4.1 Playback Scheduler vNext plan](tdd/2026-08-27-playback-scheduler-vnext.md)
8. [World ADR-0002 — WorldSaveV9 Temporal and Calendar Policy Migration](../world/adrs/0002-world-save-v9-calendar-policy-migration.md)

System-specific TDD plans live under each `docs/systems/<system>/tdd/` directory. PR #83 plans/ADR-0004/World ADR-0001 remain historical evidence and are not successor implementation authority.
