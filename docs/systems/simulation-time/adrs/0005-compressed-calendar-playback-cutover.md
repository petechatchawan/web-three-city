# ADR-0005: Compressed Calendar and Playback Cutover

**Status:** Proposed — successor design approved; two migration policies require owner reconfirmation  
**Date:** `2026-08-26`  
**System:** `simulation-time`  
**Supersedes when accepted:** ADR-0004 proposal

## Context

ADR-0004 intentionally deferred the compressed calendar/playback decision while PR #83 stabilized the existing temporal system. PR #83 is now merged and closed. The successor Temporal Authority & Simulation Clock Standard v1 adopts the compressed city-builder calendar as the target product model.

The audit found one material discrepancy: the merged runtime currently advances nominally at 1.0/0.5/0.25 real seconds per GameMinute at x1/x2/x4, while the previously proposed standard is 3.0/1.5/0.75. The proposed table is therefore three times slower than the current scheduler, despite owner feedback that current x4 already feels slow.

## Proposed Decision

Calendar mapping:

```text
60 GameMinutes = 1 GameHour
24 GameHours   = 1 Simulation Cycle = 1 Calendar Month
12 Months      = 1 Calendar Year
```

`AbsoluteGameMinute` remains the sole mutable world temporal authority. Calendar month/year/clock values are pure projections under a versioned calendar policy.

Playback remains a real-time request policy only. It never modifies domain durations, settlement intervals, construction durations, Mobility schedules, or Traffic authority semantics.

The design baseline proposes:

```text
x1 = 3.000s / GameMinute
x2 = 1.500s / GameMinute
x4 = 0.750s / GameMinute
```

but this exact table is gated on explicit owner reconfirmation after comparison with the current nominal 1.0/0.5/0.25 baseline.

## Required Cutover Semantics

- The 24-hour clock remains the citizen/Traffic daily simulation cycle.
- Crossing `23:59 -> 00:00` advances the calendar month.
- Crossing December `23:59 -> 00:00` advances the calendar year.
- No day counter becomes a second mutable authority.
- Any monthly/yearly RCI or Economy rule must bind explicitly to the new policy and must not inherit a legacy 30-day assumption accidentally.
- Performance comparisons use identical pacing; slower playback cannot be used to mask temporal workload regressions.

## Consequences

### Positive

- Month/year progression becomes visible in ordinary play sessions.
- Calendar, schedule resolution, and playback pacing become separate concepts.
- All domains derive from one timeline.

### Negative

- Legacy 30-day/month display semantics require a migration policy.
- RCI aging/lifecycle and Economy monthly/yearly concepts require explicit review/rebalance.
- The originally proposed playback table may not satisfy the product goal because it is slower than the merged baseline.

## Alternatives

### Keep the 30-day/month calendar

Rejected by the successor product direction; it does not provide the desired compressed city-builder progression.

### Introduce a second mutable month/year clock

Rejected because it permits divergence from `AbsoluteGameMinute`.

### Change pacing and calendar in one opaque constant patch

Rejected. Calendar mapping is simulation semantics; pacing is real-time UX. Each needs independent tests and explicit evidence.

## Enforcement

- Calendar projection boundary tests, including every hour boundary and month/year rollover.
- Domain parity/rebalance tests for RCI and Economy.
- Browser tests for Pause/x1/x2/x4 across multiple hours/months.
- Exact pacing values require explicit owner confirmation in the successor spec review before production code changes.

## Supersession

Upon owner confirmation of the pacing table and legacy-calendar migration policy, this ADR becomes Accepted and supersedes ADR-0004. ADR-0004 remains historical evidence of the previously deferred proposal.
