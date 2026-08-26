# Temporal Authority & Simulation Clock Standard v1 — Successor Design

**Status:** Design-review candidate — production implementation not started  
**System:** `simulation-time`  
**Date:** `2026-08-26`  
**Baseline:** `master@df5b831f7bd25f2f8015ea04b1f3a5d17753c11b` after PR #83  
**Supersedes for successor scope:** the deferred Phase 2/Phase 3 sections of `2026-08-25-temporal-authority-standard-v1.md`

## 1. Purpose

PR #83 stabilized the current temporal system. This successor is the deliberate architectural migration to one explicit temporal standard across Simulation, Building, RCI, Economy, Citizen Mobility, Traffic, persistence, playback, and calendar presentation.

The migration is not another Clock Freeze patch. It removes ambiguous temporal units and makes the intended city-builder calendar/playback model a versioned product contract.

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
3. Absolute values and durations are distinct types.
4. Cross-unit conversion/comparison is explicit and centralized.
5. One successful temporal minute preserves the ordered five-phase authority chain and final revision delta `+5`.
6. One rejected temporal minute leaves externally visible minute/revision/world unchanged, pauses playback, clears accumulated real time, exposes one typed failure, and never silently retries.
7. Playback rate changes only how quickly real time requests GameMinutes; it never divides Building, RCI, Economy, Mobility, or Traffic gameplay durations.

## 3. Audit of the Merged Baseline

The successor starts from a useful but only partially explicit foundation:

- `simulation-core` is dependency-free and already owns minute/calendar derivation. It remains the preferred Level-0 temporal owner; no `temporal-core` package is created unless a real dependency cycle appears.
- Simulation V3 persists `absoluteGameMinute`; Simulation V1/V2 `absoluteTick` is an hourly cursor and already migrates with checked `* 60`.
- Building lifecycle fields retain `*AtTick` / `*Ticks` names, but the implementation evaluates them against macro-hour indexes. That is direct evidence for 1:1 semantic rename, not `* 60` conversion.
- RCI tick plans likewise evaluate at `macroHourTransition.afterMacroHourIndex` while retaining generic Tick names.
- Economy settlement stores Tick-named boundaries and runs from macro-hour transitions; it also contains local `floor(gameMinute / 60)` logic that must move behind temporal helpers.
- Mobility stores raw `departureGameMinute` / `nextBoundaryGameMinute` numbers.
- Traffic V2 already distinguishes `arrivedAtTransportSecond` and a transport cursor, but still uses raw numbers and local `gameMinute * 4` conversions.
- `apps/game` already stages `GameMinute -> Q1 -> Q2 -> Q3 -> Q4` and publishes the complete chain atomically through `publishBatchForTransaction`. The successor formalizes and types this behavior rather than redesigning it.
- World persistence currently writes WorldSaveV8 and reads legacy V1–V8 inputs.

The detailed evidence map is recorded in `../verification/2026-08-26-temporal-authority-legacy-semantics-audit.md`.

## 4. Explicit Temporal Units

`simulation-core` owns opaque temporal point/duration types:

```ts
AbsoluteGameMinute
GameMinuteDuration
MacroHourIndex
MacroHourDuration
CalendarMonthIndex
CalendarYearIndex
```

Traffic consumes `AbsoluteGameMinute` and owns/uses transport-resolution types through the temporal contract:

```ts
AbsoluteTransportSecond
TransportSecondDuration
```

The exact module placement may keep transport types in `traffic-core` if doing so avoids inappropriate upward ownership. The dependency invariant is more important than the physical file: `simulation-core` must never import Traffic, Mobility, Economy, Building, or RCI.

Named APIs replace open-coded arithmetic:

```ts
deriveMacroHourIndex(gameMinute)
deriveClockOfCycle(gameMinute)
deriveCalendarMonth(gameMinute)
deriveCalendarYear(gameMinute)
addGameMinutes(point, duration)
addMacroHours(point, duration)
addTransportSeconds(point, duration)
hasReachedMacroHour(...)
```

Domain code must not spread formulas such as `gameMinute / 60`, `macroHour * 60`, or `gameMinute * 4`.

### Architecture enforcement

Branded numbers alone are insufficient because TypeScript relational/arithmetic operators still accept number-like values. Static architecture/compiler checks therefore reject:

- arithmetic between incompatible temporal units;
- relational comparison between incompatible temporal units;
- direct raw casts into temporal brands;
- `as unknown as TemporalType` escape paths outside trusted constructors/codecs.

Raw JSON enters through validating temporal constructors/decoders only.

## 5. Calendar Standard

The target compressed calendar is:

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

There is no mutable day/month/year cursor. All display/schedule projections derive from `AbsoluteGameMinute` plus the versioned calendar policy.

The existing 24h/day, 30d/month calendar is a legacy calendar policy and must not be silently interpreted as the new policy in persisted data.

## 6. Playback Standard and Audit Gate

The approved design baseline proposes:

```text
Pause
x1 = 3.000 real seconds / GameMinute
x2 = 1.500 real seconds / GameMinute
x4 = 0.750 real seconds / GameMinute
```

This implies at x4:

```text
1 GameHour       = 45 real seconds
1 Calendar Month = 18 real minutes
1 Calendar Year  = 3h 36m real time
```

### Required owner reconfirmation before production edit

The merged baseline currently uses `GAME_MINUTE_MILLISECONDS = 1000` with multipliers `1/2/4`, i.e. nominally:

```text
x1 = 1.000s / GameMinute
x2 = 0.500s / GameMinute
x4 = 0.250s / GameMinute
```

Therefore the proposed 3.0/1.5/0.75 standard is exactly **3x slower in nominal scheduler pacing** than the current runtime. This conflicts with the observed product complaint that x4 already feels too slow.

This is not resolved by implementation cleverness. Before the playback PR begins, the owner must explicitly choose one of:

- keep the approved 3.0/1.5/0.75 city-builder pacing despite being slower nominally;
- retain current 1.0/0.5/0.25 pacing and redesign only calendar/authority semantics;
- approve another measured pacing table.

No implementation PR may silently choose a pacing value.

## 7. Temporal Minute Atomicity

The merged baseline already provides most of the intended transaction topology. Keep it:

1. capture immutable original world at revision `R`;
2. plan GameMinute candidate `R+1`;
3. plan Q1–Q4 against staged candidates `R+2..R+5`;
4. if any phase rejects, publish none of the five;
5. if all pass, install the ordered chain atomically and expose final world once;
6. synchronize final presentation once and notify committed-world subscribers once.

`TemporalAdvanceResult` remains a discriminated committed/rejected result, but all temporal fields migrate to explicit units.

`step()` succeeds only for minute `+1`, revision `+5`, and five ordered phase receipts.

`stepMinutes(n)` is atomic per minute: previous successful minutes remain committed, and execution stops at the first rejected minute with `committedMinutes`, rejected point, phase, and typed reason.

## 8. Domain Contract Migration

### Building

Rename lifecycle fields semantically without changing their represented macro-hour values:

```ts
constructionStartedAtMacroHourIndex
constructionCompletesAtMacroHourIndex
activatedAtMacroHourIndex
constructionDurationMacroHours
```

`building-core` remains the sole owner of lifecycle validation/state/progress. Presentation and world/save validation call Building APIs rather than compare timestamps directly.

### RCI

Rename temporal state from generic Tick language to macro-hour semantics:

```text
*AtTick  -> *AtMacroHourIndex
*Ticks   -> *MacroHours
beforeAbsoluteTick / afterAbsoluteTick -> explicit macro-hour fields where that is the actual meaning
```

Historical/golden tests must prove each migrated field before rename.

### Economy

Economy gains a one-way dependency on `simulation-core` if needed. Settlement fields become explicit macro-hour points/durations. Open-coded game-minute-to-hour conversion is removed.

The compressed calendar changes what a “month/year” means. Any monthly/yearly accounting rule must explicitly bind to the new calendar policy rather than reuse a legacy 30-day assumption.

### Citizen Mobility

`departureGameMinute` and `nextBoundaryGameMinute` become `AbsoluteGameMinute` values. Schedule day/cycle semantics must be reviewed against the compressed calendar; a citizen daily clock remains a 24-hour simulation cycle even though that cycle is presented as a calendar month.

### Traffic

Traffic keeps four transport quanta per GameMinute and existing physical semantics. Raw `gameMinute * 4` / legacy `arrivedAtGameSecond * 4` conversions move behind temporal migration helpers. No new Far tier, rendering policy, capacity change, route rule, or scheduler topology belongs in this migration.

## 9. WorldSaveV9 and Calendar Policy

The successor targets:

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
Writer authority after cutover: WorldSave V9 only.

V9 must identify both temporal unit semantics and calendar interpretation at the envelope level without wrapping every high-cardinality timestamp object. Conceptually:

```ts
temporalStandardVersion: 1
calendarPolicyVersion: 1 // compressed 24h-cycle-as-month policy
```

Exact field naming is codec-level implementation detail; the discriminator behavior is not.

Legacy rules already supported by source evidence:

- Simulation V1/V2 `absoluteTick` -> GameMinute using checked `* 60`.
- Building legacy lifecycle Tick fields -> MacroHour 1:1.
- RCI/Economy Tick fields -> MacroHour 1:1 only after golden field-by-field proof.
- Mobility GameMinute fields -> AbsoluteGameMinute 1:1.
- Traffic V2 TransportSecond fields -> AbsoluteTransportSecond 1:1.

### Legacy calendar-label continuity decision

A V8 save contains `AbsoluteGameMinute` produced under the legacy 30-day calendar. If that number is preserved 1:1 while V9 immediately adopts the compressed calendar, its displayed month/year changes even though simulation authority is continuous.

Before V9 codec implementation, owner policy must choose explicitly:

A. **Authority continuity (recommended for deterministic domain continuation):** preserve `AbsoluteGameMinute` 1:1 and accept the one-time calendar-label reinterpretation when an old city migrates.

B. **Display-calendar continuity:** define a one-time checked remap that preserves the displayed legacy calendar position, with separate tests proving Mobility/RCI/Economy/Building continuation semantics.

No V8 save may be silently reinterpreted without the selected rule being encoded in migration tests and ADR-0002.

## 10. Migration Strategy

Use vertical authority migration, not a big bang and not a long-lived dual-clock compatibility layer.

Recommended PR sequence after this design is approved:

```text
T1  Explicit Temporal Units + architecture enforcement
T2  Building / RCI / Economy macro-hour migration
T3  Mobility / Traffic temporal migration
T4  Calendar policy cutover + playback controller
T5  WorldSaveV9 codecs + V1–V8 golden migration
T6  Game/UI integration + full browser/owner release closure
T7  Legacy temporal naming/facade cleanup after all consumers are proven
```

Each PR must leave one authoritative timeline and keep master releasable. Temporary compatibility adapters are allowed only inside the active migration seam and must have a planned deletion owner; no consumer may maintain parallel mutable old/new clocks.

## 11. TDD Gates

Before production edits in each slice, RED tests must prove the intended semantic boundary.

Minimum suite across the migration:

- compile/architecture rejection of cross-unit assignment/operators/casts;
- all 24 `HH:59 -> HH+1:00` transitions;
- Growth at `00/06/12/18` and valid no-eligible-lot no-op;
- Building start/progress/completion on macro-hour boundaries;
- RCI and Economy boundary parity before/after semantic rename;
- Mobility continuation and Traffic four-quanta/minute parity;
- successful minute exactly five ordered revisions/receipts;
- rejected minute unchanged + paused + no automatic retry;
- compressed month and December->January year boundaries;
- save at `N:59`, load, continue through `N+1:00` identically;
- golden WorldSave V1–V8 migration and V9 round-trip;
- construction-in-progress save/load;
- x1/x2/x4 multi-hour and multi-month browser acceptance;
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
building-three
Game affected tests
Save/migration/continuation suites
Chromium @building @rci @traffic @interaction
pnpm test:deployment
pnpm verify
pnpm verify:full
git diff --check
clean tracked worktree
non-force push
exact-head CI
Sonar
Owner 414x896 acceptance
```

Performance evidence must compare candidates at identical pacing. A pacing change is product behavior, not a performance optimization and may not be used to hide temporal workload regressions.

## 13. Non-Goals

- Rewriting Traffic routing, Mobility policy, renderer, Road authority, Growth policy, or world scheduler unrelated to temporal units.
- Adding seasons before the calendar foundation is stable.
- Offline catch-up or arbitrary fast-forward scheduler.
- Persisting playback accumulator/speed unless separately approved.
- Keeping two mutable world clocks for compatibility.

## 14. Documentation and Handoff

Required living-doc updates during implementation:

- `simulation-time`, Buildings, RCI, Economy, Citizen Mobility, Traffic, World READMEs;
- static dependency/Level-2 verification map;
- ADR-0003 explicit temporal units;
- successor calendar/playback ADR;
- WorldSaveV9 calendar-policy migration ADR;
- per-system TDD and verification evidence under `docs/systems/<system>/`.

## 15. Design Review Gates

Everything except the following two audit discoveries is considered locked by the approved baseline design:

1. **Playback pacing:** current runtime is nominally 1.0/0.5/0.25s per minute; proposed standard is 3.0/1.5/0.75s and therefore slower.
2. **Legacy calendar-label continuity:** V8 `AbsoluteGameMinute` needs an explicit owner policy when switching from the 30-day calendar to 24h=month.

Production implementation must not begin until the written spec is reviewed and those two policies are explicitly confirmed.
