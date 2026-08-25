# ADR-0004: Simulation Calendar and Playback Standard

**Status:** Proposed — implementation deferred
**Date:** `2026-08-25`
**System:** `simulation-time`

## Context

The current calendar projects 24 hours/day, 30 days/month, and 12 months/year,
while playback advances one game minute per real second at x1. A compressed
city-builder calendar could make month/year progression observable, but changing
calendar mapping also changes RCI aging/lifecycle cadence, Economy accounting,
Save date interpretation, HUD copy, temporal batch frequency, and performance
evidence.

## Proposed Decision

Evaluate a separate product milestone with:

- 60 game minutes per hour;
- one 24-hour simulation cycle per calendar month;
- 12 calendar months per year;
- proposed pacing of 3.0, 1.5, and 0.75 real seconds per game minute at x1, x2,
  and x4.

`AbsoluteGameMinute` remains the sole authority. Calendar fields are projections.
Traffic quanta stay staged inside one atomic minute; sub-minute wall-clock values
apply only to presentation interpolation.

This proposal is not implementation authority until RCI, Economy, migration,
performance, and owner UX policies are approved in the Phase 3 specification.

## Consequences

### Positive

- Players can observe month/year progression in bounded play sessions.
- Playback remains separate from gameplay duration semantics.

### Negative

- Existing 360-day RCI-year constants cannot be reused without an explicit age
  and lifecycle rebalance.
- Existing saves cannot be silently reinterpreted under the new calendar.
- Slower temporal batches can mask performance regressions if mixed with PR #83.

## Alternatives Considered

### Adopt the proposal inside PR #83

Rejected because it combines a correctness fix with gameplay pacing and calendar
redesign and invalidates existing performance comparisons.

### Change calendar projection without versioning

Rejected because identical saved authority would display and schedule a
different date after update.

### Keep the current calendar indefinitely

Retained as the active default until product evidence justifies migration.

## Enforcement

- PR #83 and WorldSaveV9 tests lock current calendar and pacing.
- Phase 3 requires an approved replacement specification and migration version.
- Performance evidence compares candidates at identical pacing.

## Supersession

If accepted later, replace this Proposed record with a new Accepted ADR; do not
rewrite this proposal in place.
