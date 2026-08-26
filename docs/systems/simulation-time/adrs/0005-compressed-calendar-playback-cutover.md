# ADR-0005: Compressed Calendar and Playback Cutover

**Status:** Accepted  
**Date:** `2026-08-26`  
**System:** `simulation-time`  
**Supersedes:** ADR-0004 proposal

## Context

ADR-0004 deferred compressed calendar/playback while PR #83 stabilized temporal authority. The merged runtime currently advances nominally at 1.0/0.5/0.25 real seconds per GameMinute at x1/x2/x4. The earlier 3.0/1.5/0.75 proposal is therefore three times slower than the merged runtime and conflicts with the product direction.

The successor also needs a calendar that makes month/year progression observable without introducing another mutable world clock.

## Decision

Calendar mapping:

```text
60 GameMinutes = 1 GameHour
24 GameHours   = 1 Simulation Cycle = 1 Calendar Month
12 Months      = 1 Calendar Year
```

`AbsoluteGameMinute` remains the sole mutable world temporal authority. Calendar month/year/clock values are pure projections under `calendarPolicyVersion = 1`.

The 24-hour Simulation Cycle remains the repeating operational cadence for Growth, RCI lifecycle evaluation, Economy settlement, and citizen schedules. Displaying a cycle as a calendar month does not automatically redefine those operational rules as monthly accounting/scheduling policies.

Playback remains application-only real-time request policy and retains merged effective pacing:

```text
Pause = no automatic minute requests
x1 = 1.000s / GameMinute
x2 = 0.500s / GameMinute
x4 = 0.250s / GameMinute
```

The 3.0/1.5/0.75 table is rejected for this migration. Future faster/slower tuning requires a separate product decision.

At nominal x4:

```text
1 GameHour       = 15 real seconds
1 Calendar Month = 6 real minutes
1 Calendar Year  = 72 real minutes
```

These are scheduler ratios, not a guarantee of browser frame performance.

## Required Cutover Semantics

- Crossing `23:59 -> 00:00` advances the calendar month.
- Crossing December `23:59 -> 00:00` advances the calendar year.
- No mutable day/month/year cursor is added.
- RCI age and annual-rate policy binds to the new 12-cycle calendar year; migration preserves existing citizen age semantics separately from canonical world-time continuity.
- Operational RCI/Economy/Mobility cycle cadence remains 24 hours unless separately redesigned.
- Performance comparisons use identical playback pacing; pacing changes cannot mask workload regressions.

## Consequences

### Positive

- Month/year progression is visible in ordinary play sessions.
- Calendar, domain duration, and playback pacing are separate concepts.
- Existing runtime speed is not accidentally slowed by the migration.
- All calendar labels still derive from one authority.

### Negative

- Legacy 30-day/month labels change when old saves migrate under the new calendar policy.
- RCI age/hazard semantics require explicit migration/rebalance rather than a blanket Tick rename.
- Future true monthly/yearly Economy mechanics need separate policy because the current settlement is operational-cycle based.

## Alternatives Considered

### Keep 30-day/month calendar
Rejected because it does not achieve the approved compressed city-builder progression.

### Adopt 3.0/1.5/0.75 pacing
Rejected because it is exactly three times slower than the merged runtime.

### Introduce a mutable month/year clock
Rejected because it can diverge from `AbsoluteGameMinute`.

### Change calendar and domain durations through one constant
Rejected because presentation calendar, operational recurrence, and gameplay durations are distinct semantics.

## Enforcement

- Calendar boundary tests for hour/month/year rollover.
- Deterministic runtime tests for exact Pause/x1/x2/x4 minute-request behavior.
- RCI age/hazard and migration tests.
- Domain parity tests proving operational 24-hour cycle consumers do not run 30x more/less often.
- Browser evidence for speed controls and rollover presentation.
- Owner 414x896 acceptance.

## Supersession

This ADR supersedes ADR-0004. ADR-0004 remains historical evidence of the deferred proposal and is not implementation authority.