# Temporal Authority & Simulation Clock Standard v1 — Successor Design

**Status:** APPROVED — TDD planning complete; production implementation not started  
**System:** `simulation-time`  
**Date:** `2026-08-26`  
**Baseline:** `master@df5b831f7bd25f2f8015ea04b1f3a5d17753c11b` after PR #83  
**Planning PR:** #94  
**Supersedes for successor scope:** deferred Phase 2/Phase 3 sections of `2026-08-25-temporal-authority-standard-v1.md`

## 1. Purpose

PR #83 stabilized the merged temporal system. This successor deliberately migrates Simulation, Building, RCI, Economy, Citizen Mobility, Traffic, persistence, playback, and calendar presentation onto one explicit temporal standard.

This is not another Clock Freeze patch. It removes ambiguous units, preserves deterministic five-phase authority, introduces a compressed city-builder calendar, and makes Save migration semantics explicit.

## 2. Locked Authority Model

```text
REAL TIME
   |
   v
Playback Controller / Accumulator
Pause / x1 / x2 / x4
   |
   | requests whole GameMinutes only
   v
AbsoluteGameMinute
CANONICAL WORLD TEMPORAL AUTHORITY
   |----------------------+----------------------+
   v                      v                      v
Calendar Projection       MacroHourIndex         Transport Cursor
HH:mm / Month / Year      Building / RCI /       Traffic / Mobility
                          Economy
   \______________________|______________________/
                          |
                          v
                Deterministic World Step

          GameMinute -> Q1 -> Q2 -> Q3 -> Q4
                    exactly 5 revisions
```

Hard invariants:

1. `AbsoluteGameMinute` is the sole mutable world-calendar authority.
2. Calendar fields are projections, never parallel mutable clocks.
3. Absolute points and durations are distinct temporal types.
4. Cross-unit conversion/comparison is explicit and centralized.
5. One successful temporal minute preserves `GameMinute -> Q1 -> Q2 -> Q3 -> Q4` and final world revision `+5`.
6. One rejected temporal minute leaves externally visible minute/revision/world unchanged, pauses playback, clears accumulated real time, exposes one typed failure, and never silently retries.
7. Playback rate changes only how quickly real time requests GameMinutes. It never divides Building, RCI, Economy, Mobility, or Traffic gameplay durations.
8. `simulation-core` remains the Level-0 temporal owner. It never imports Building, RCI, Economy, Mobility, Traffic, presentation, or app code.

## 3. Merged Baseline Audit

The merged baseline already provides the correct topological foundation:

- Simulation V3 persists `absoluteGameMinute`; Simulation V1/V2 `absoluteTick` is an hourly cursor and migrates with checked `*60`.
- Building lifecycle `*Tick` fields are evaluated against macro-hour indexes and therefore represent macro-hour semantics.
- RCI tick planning executes at `macroHourTransition.afterMacroHourIndex`, but RCI additionally embeds legacy `360 days/year` age/hazard policy that must be deliberately rebalanced for the compressed calendar.
- Economy settlement is macro-hour/cycle based and includes local minute-to-hour conversion that must move behind Simulation helpers.
- Mobility stores GameMinute schedule points as raw numbers.
- Traffic V2 already distinguishes transport-second state but still uses raw values/conversions.
- Game already stages `GameMinute -> Q1 -> Q2 -> Q3 -> Q4` and atomically publishes the validated batch. This topology is retained, not rewritten.
- World persistence currently writes WorldSaveV8 and reads historical inputs.

Detailed evidence: `../verification/2026-08-26-temporal-authority-legacy-semantics-audit.md`.

## 4. Explicit Temporal Units

`simulation-core` owns integer-backed opaque types:

```ts
AbsoluteGameMinute
GameMinuteDuration
MacroHourIndex
MacroHourDuration
```

Calendar month/year are projections from the canonical GameMinute and may use strongly typed projection values, but they are not mutable authorities.

Traffic consumes `AbsoluteGameMinute` and owns transport-resolution types:

```ts
AbsoluteTransportSecond
TransportSecondDuration
```

Required named APIs include:

```ts
absoluteGameMinute(value)
gameMinuteDuration(value)
macroHourIndex(value)
macroHourDuration(value)
deriveMacroHourIndex(gameMinute)
deriveSimulationCycleIndex(gameMinute)
deriveGameCalendarFromGameMinute(gameMinute)
addGameMinutes(point, duration)
addMacroHours(point, duration)
compareGameMinutes(a, b)
compareMacroHours(a, b)
```

Traffic owns the subordinate conversion:

```ts
transportSecondAtGameMinute(gameMinute)
addTransportSeconds(point, duration)
```

Domain production code must not spread formulas such as `gameMinute / 60`, `macroHour * 60`, or `gameMinute * 4`.

### Architecture enforcement

Branded numbers alone are insufficient because TypeScript permits numeric operators on them. Repository tooling must therefore reject:

- incompatible temporal arithmetic/comparison;
- direct casts into temporal branded types;
- `as unknown as TemporalType` escape paths outside trusted constructors/codecs;
- a dependency from `simulation-core` upward into any domain/application/presentation package.

Raw JSON enters through validating decoders/constructors only.

## 5. Locked Compressed Calendar

The approved calendar is:

```text
60 GameMinutes = 1 GameHour
24 GameHours   = 1 Simulation Cycle = 1 Calendar Month
12 Months      = 1 Calendar Year
```

Examples:

```text
January 23:59 + 1 GameMinute -> February 00:00
December 23:59 Year 1 + 1 GameMinute -> January 00:00 Year 2
```

There is no mutable day/month/year cursor. The 24-hour Simulation Cycle remains the recurring operational cycle for Growth, RCI lifecycle evaluation, Economy settlement, and citizen schedules even though presentation labels that cycle as a calendar month.

## 6. Locked Playback Policy

Owner review resolved the pacing conflict by retaining the merged production cadence for this migration:

```text
Pause = no automatic GameMinute requests
x1    = 1.000 real second / GameMinute
x2    = 0.500 real second / GameMinute
x4    = 0.250 real second / GameMinute
```

The earlier `3.000 / 1.500 / 0.750` proposal is rejected for this successor because it is exactly 3x slower than the merged runtime and conflicts with the product goal.

Playback is an application-only request policy. A future faster/slower tuning is a separate product/performance decision and must not be smuggled into temporal-unit/calendar migration.

At x4 under the approved calendar/pacing:

```text
1 GameHour       = 15 real seconds
1 Calendar Month = 6 real minutes
1 Calendar Year  = 72 real minutes
```

These are nominal scheduler values; browser performance must not be inferred from arithmetic alone.

## 7. Temporal Minute Atomicity

Retain the merged topology:

1. capture immutable original world at revision `R`;
2. plan GameMinute candidate `R+1`;
3. plan Q1–Q4 against staged candidates `R+2..R+5`;
4. if any phase rejects, publish none of the five;
5. if all pass, install the ordered chain atomically;
6. synchronize final presentation once;
7. notify committed-world subscribers once.

`TemporalAdvanceResult` remains a committed/rejected discriminated union using explicit temporal types.

`step()` succeeds only for GameMinute `+1`, revision `+5`, and five ordered phase receipts. `stepMinutes(n)` is atomic per minute and stops at the first rejected minute.

## 8. Domain Migration Contracts

### 8.1 Building

Building legacy lifecycle Tick values represent macro hours and migrate 1:1. Runtime names become explicit, e.g.:

```ts
constructionStartedAtMacroHourIndex
constructionCompletesAtMacroHourIndex
activatedAtMacroHourIndex
constructionDurationMacroHours
```

Building remains the sole lifecycle validation/state/progress authority. World/Game/presentation code must call Building lifecycle APIs instead of comparing lifecycle timestamps directly.

### 8.2 RCI

RCI requires field-by-field semantic classification before rename. Tick-suffixed state is classified as one of:

```text
age-origin
macro-hour point
macro-hour duration
simulation-cycle index
historical event point
```

The compressed calendar deliberately changes RCI year semantics:

```text
legacy: 360 cycles/year = 8640 macro hours/year
new:     12 cycles/year =  288 macro hours/year
```

Therefore:

- future age-years and age bands use 288 macro hours/year;
- annual fertility/mortality rate definitions remain annual rates;
- per-cycle hazard is compiled so 12 cycle evaluations compound to the annual rate;
- the 08:00 recurring lifecycle evaluation remains once per 24-hour Simulation Cycle.

#### RCI migration invariant

Canonical `AbsoluteGameMinute` remains 1:1, but age-origin fields such as `bornAtTick` must not migrate blindly 1:1 because that would make old citizens approximately 30x older under the new year length.

At cutover, age-origin elapsed time is rescaled relative to current macro hour:

```text
legacyElapsed = currentMacroHour - legacyBornMacroHour
newElapsed    = floor(legacyElapsed * 288 / 8640)
newBorn       = currentMacroHour - newElapsed
```

Checked integer arithmetic is required. This preserves whole age-years, age-band, monotonic ordering, and proportional fractional-year position at migration. Historical/event/cycle fields use their separately proven migration rule and are not automatically age-scaled.

### 8.3 Economy

Economy consumes Simulation temporal helpers. Settlement fields become explicit macro-hour/cycle points/durations. Existing settlement stays once at the 08:00 boundary of each Simulation Cycle and retains current tax/maintenance/ledger formulas.

The fact that a Simulation Cycle is displayed as a calendar month does **not** automatically turn the existing operational settlement into a new monthly accounting rule. Future month/year financial policy must be separately specified.

### 8.4 Citizen Mobility

`departureGameMinute` and `nextBoundaryGameMinute` become `AbsoluteGameMinute` values 1:1. A legacy `scheduleCursorDay` that is merely a 24-hour recurrence counter is renamed to Simulation Cycle semantics. Mobility never owns calendar month/year authority.

### 8.5 Traffic

Traffic keeps four transport quanta per GameMinute and existing physical semantics. It owns `AbsoluteTransportSecond` and named GameMinute-to-transport conversion. Raw `gameMinute * 4`/legacy conversion arithmetic is confined to migration helpers and then removed from production consumers.

No routing, headway, lane, intersection, cap, rendering, Road, or scheduler-topology change belongs in this migration.

## 9. WorldSaveV9

Target codecs:

```text
SimulationSaveV4
BuildingSaveV3
RciSaveV2
EconomySaveV2
MobilitySaveV3
TrafficSaveV3
WorldSaveV9
```

Reader authority: WorldSave V1–V9.  
Canonical writer after T5: WorldSave V9 only.

The V9 envelope carries:

```ts
temporalStandardVersion: 1
calendarPolicyVersion: 1
```

Values remain compact validated integers; no per-record `{value, unit}` wrappers.

### Locked legacy calendar policy

Owner review approved **authority continuity**:

- preserve V8 `AbsoluteGameMinute` 1:1;
- project the migrated city using the compressed V9 calendar;
- accept that the displayed month/year of a legacy save changes at first migration;
- do not remap the canonical world clock merely to preserve the old 30-day-calendar label.

Domain migrations still preserve their own semantics. In particular, RCI age-origin rescaling prevents citizen age jumps while canonical world time stays unchanged.

### Legacy unit rules

- Simulation V1/V2 hour `absoluteTick` -> GameMinute using checked `*60`.
- Building lifecycle macro-hour fields -> 1:1.
- Economy operational macro-hour/cycle fields -> 1:1 after golden proof.
- RCI fields -> classification-driven; age-origin is rescaled as above.
- Mobility GameMinute -> 1:1.
- Traffic V2 TransportSecond -> 1:1.

Unknown V9 temporal/calendar policy discriminators reject the entire Save.

## 10. Migration Strategy

Use vertical authority migration, not a big bang and not a long-lived dual-clock layer:

```text
T1  Explicit Temporal Units + architecture enforcement
T2A Building macro-hour migration
T2B RCI temporal/calendar migration
T2C Economy temporal migration
T3A Mobility temporal migration
T3B Traffic temporal migration
T4  Compressed calendar projection + unchanged playback policy
T5  WorldSaveV9 + V1-V8 golden migration
T6  Game/UI/release cutover
T7  Legacy runtime naming/facade cleanup after T1-T6 are proven
```

Each slice must leave one authoritative timeline and keep master releasable. Compatibility adapters are limited to the active migration seam and historical codec readers.

Execution index: `../tdd/2026-08-26-temporal-successor-execution-index.md`.

## 11. TDD Acceptance Matrix

Required RED/GREEN coverage across the migration:

- constructor/type/architecture rejection for incompatible units/casts;
- all 24 `HH:59 -> HH+1:00` macro-hour transitions;
- Growth at `00/06/12/18`;
- Building start/progress/completion parity;
- RCI field-class completeness;
- RCI age `287 -> 288` macro-hour boundary;
- RCI 12-cycle annual hazard compounding;
- RCI V8 age-origin migration preserving age-years/age-band;
- Economy 08:00 cycle settlement parity;
- Mobility schedule/commute parity;
- Traffic four-quanta/minute parity;
- successful minute exactly five ordered revisions/receipts;
- rejected minute unchanged + paused + no automatic retry;
- month rollover and December->January year rollover;
- playback x1/x2/x4 exact deterministic request behavior;
- save at `N:59`, load, continue through `N+1:00`;
- golden WorldSave V1–V8 migrations and V9 roundtrip;
- construction-in-progress and active-traffic save/load;
- targeted browser time/Growth/RCI/Traffic/interaction evidence;
- canonical 414x896 owner acceptance.

## 12. Verification Order

```text
focused RED/GREEN owner tests
simulation-core
building-core
rci-core
economy-core
citizen-mobility-core
traffic-core
presentation consumers
Game affected tests
Save/migration/continuation suites
pnpm test:deployment
pnpm check
build browser artifact
targeted Chromium relevant tags
git diff --check
clean tracked worktree
non-force push
exact-head CI
Sonar
Owner 414x896 acceptance
```

`pnpm verify:full` is reserved for the final/shared release gate when repository policy requires it. CI is an exact-head independent verifier, not the first debugger. Never push intentional RED.

## 13. Non-Goals

- Traffic/Road renderer rewrite or performance-policy changes.
- Route, lane, junction, headway, capacity, or trip-policy changes.
- Growth eligibility/policy redesign.
- New monthly/yearly Economy mechanics.
- Seasons or leap years.
- Offline catch-up/arbitrary fast-forward scheduler.
- Persisted runtime playback accumulator/speed.
- Faster-than-current x4 tuning.
- A second mutable calendar clock.

## 14. Documentation and Handoff

Implementation updates must remain system-owned under `docs/systems/<system>/`:

- specs and ADRs in the owning system;
- TDD plans in each system `tdd/` directory;
- verification evidence in each system `verification/` directory;
- system README summaries updated after each merged slice.

The successor execution index and PR #94 are the cross-system handoff entry points.

## 15. Design Review Closure

The two original review gates are resolved:

1. **Playback:** retain current nominal `1.000 / 0.500 / 0.250` seconds per GameMinute at x1/x2/x4.
2. **Legacy calendar continuity:** preserve canonical `AbsoluteGameMinute` 1:1 and accept compressed-calendar label reprojection.

The RCI audit additionally locks age-preserving age-origin migration so the calendar cutover does not create a 30x citizen-age jump.

This design is APPROVED for TDD implementation planning. Production edits begin only through the ordered T1+ slices and their RED/GREEN gates.