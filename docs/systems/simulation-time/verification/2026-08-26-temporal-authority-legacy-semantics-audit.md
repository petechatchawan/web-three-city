# Temporal Authority Legacy Semantics Audit

**Status:** Audit complete; design decisions incorporated into the approved successor spec  
**Date:** `2026-08-26`  
**Baseline:** `master@df5b831f7bd25f2f8015ea04b1f3a5d17753c11b`

## Summary

The merged repository already has the correct single-clock and five-phase transaction topology, but temporal values are still represented by multiple raw-number units and legacy `Tick` names. The successor should therefore migrate contracts and codecs, not redesign the core transaction model.

## Confirmed Findings

### Simulation

- `SimulationSnapshot.absoluteGameMinute` is the canonical persisted world time.
- Simulation V1/V2 `absoluteTick` is an hourly cursor and existing migration semantics are checked `*60` to GameMinutes.
- `simulation-core` is dependency-free and can remain the Level-0 temporal owner.

### Game runtime/publication

`apps/game/src/simulation-runtime.ts` currently uses:

```text
GAME_MINUTE_MILLISECONDS = 1000
normal multiplier = 1
fast multiplier   = 2
faster multiplier = 4
```

Therefore nominal pacing is x1/x2/x4 = `1.000/0.500/0.250s` per GameMinute.

`apps/game/src/temporal-publication-controller.ts` already stages:

```text
GameMinute -> Q1 -> Q2 -> Q3 -> Q4
```

and uses batch publication so the successor should preserve this exact topology.

### Buildings

Building lifecycle fields retain legacy Tick names but are evaluated through macro-hour lifecycle APIs. Their persisted/runtime numeric values are macro-hour semantics and migrate 1:1. They must never be multiplied by 60.

### Economy

Economy scheduled settlement is driven from macro-hour transition state. Runtime code includes local minute/hour conversion that should move behind Simulation helpers. Existing fiscal settlement is an operational 24-hour-cycle rule, not evidence of a separate mutable calendar.

### Citizen Mobility

Mobility `departureGameMinute` and `nextBoundaryGameMinute` are GameMinute semantics. `scheduleCursorDay` requires semantic rename if it is only a 24-hour recurrence counter; it must not become calendar authority.

### Traffic

Traffic V2 distinguishes `arrivedAtTransportSecond` and a subordinate transport cursor. It still uses raw-number contracts and local `GameMinute * 4` conversion. Four quanta per GameMinute are established behavior and remain unchanged.

## Additional RCI Audit Finding

RCI is not a simple blanket 1:1 Tick rename.

`packages/rci-core/src/population/age.ts` currently defines:

```text
RCI_TICKS_PER_DAY  = 24
RCI_DAYS_PER_YEAR  = 360
RCI_TICKS_PER_YEAR = 8640
```

`ageYearsAtTick` divides elapsed macro-hour ticks by 8640. `hazard.ts` compiles annual fertility/mortality rates into 360 daily evaluations.

The approved compressed calendar instead defines:

```text
12 Simulation Cycles/year
24 MacroHours/cycle
288 MacroHours/year
```

If canonical GameMinute and RCI `bornAtTick` were both migrated 1:1, a legacy one-year-old resident would be interpreted as roughly 30 years old after cutover. This is unacceptable.

### Locked resolution

- Keep canonical `AbsoluteGameMinute` 1:1.
- Classify every durable RCI Tick field before migration.
- Future RCI age uses 288 MacroHours/year.
- Annual rate definitions remain annual; per-cycle hazard is recomputed across 12 cycle evaluations/year.
- Age-origin timestamps are rescaled relative to current MacroHour to preserve age-years, age-band, ordering, and fractional-year phase.
- Historical event/relationship/membership/cycle fields are not automatically age-scaled; each follows its classified meaning.

Approved age-origin mapping:

```text
legacyElapsed = currentMacroHour - legacyBornMacroHour
newElapsed    = floor(legacyElapsed * 288 / 8640)
newBorn       = currentMacroHour - newElapsed
```

## Approved Product Decisions

1. Compressed calendar: `60 min/hour`, `24h = 1 Simulation Cycle = 1 calendar month`, `12 months/year`.
2. Playback retains merged nominal pacing `1.000/0.500/0.250s` at x1/x2/x4. The old `3.000/1.500/0.750` proposal is rejected.
3. V8 -> V9 preserves canonical `AbsoluteGameMinute` 1:1 and accepts calendar-label reprojection under the new policy.
4. RCI age-bearing state is migrated semantically so existing citizens do not jump in age.

## Implementation Consequence

The migration must proceed vertically through T1-T6 with system-owned RED/GREEN plans. No production implementation is authorized to bypass the execution index or combine temporal migration with Traffic/Road rendering, routing, Growth-policy, or unrelated scheduler changes.

See:

- `../specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`
- `../tdd/2026-08-26-temporal-successor-execution-index.md`
- `../adrs/0005-compressed-calendar-playback-cutover.md`
- `../../world/adrs/0002-world-save-v9-calendar-policy-migration.md`