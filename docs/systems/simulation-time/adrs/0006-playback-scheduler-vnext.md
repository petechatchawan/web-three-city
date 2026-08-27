# ADR-0006: Playback Scheduler vNext

**Status:** Accepted
**Date:** `2026-08-27`
**System:** `simulation-time` / `apps/game`
**Supersedes:** the playback-throughput portion of ADR-0005

## Context

ADR-0005 established the compressed calendar and retained the merged
nominal playback intervals of 1.000/0.500/0.250 seconds per GameMinute for
x1/x2/x4. The product now needs more responsive real-time progression. The
change must not turn a faster preset into a larger authoritative time jump,
change game-time duration semantics, or make a long frame stall unbounded.

## Decision

The application scheduler uses these rates:

```text
Pause  = 0 GameMinutes / real second
x1     = 2 GameMinutes / real second = 500ms / GameMinute
x2     = 4 GameMinutes / real second = 250ms / GameMinute
x4     = 8 GameMinutes / real second = 125ms / GameMinute
```

`SimulationSpeed` remains `paused | normal | fast | faster`, and the UI
continues to display Pause/Play, 2×, and 4×.

The scheduler requests complete GameMinutes sequentially. It never advances
the authority by 2, 4, or 8 directly. Each minute retains
`GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, and each successful minute retains
world revision delta `+5`.

The accumulator is real elapsed milliseconds. Each `advance()` call has a
maximum of eight minute attempts; unused accumulated budget is retained for
later calls. A rejected minute stops the current call, leaves prior complete
minutes committed, clears the accumulator, pauses playback, and does not
retry automatically. `step()` while paused remains exactly one minute.

This ADR changes only wall-clock playback throughput. Calendar projections,
Growth, construction durations, RCI, Economy, Mobility, Traffic, routing,
rendering, persistence, and the five-phase authority topology are unchanged.

## Consequences

### Positive

- x1/x2/x4 provide 2/4/8 GameMinutes per real second.
- Intermediate minutes and all domain boundary checks remain observable.
- Large elapsed deltas remain bounded without silently discarding budget.
- Existing UI and save contracts remain stable.

### Negative

- A single ordinary frame may request more than one complete transaction at
  higher speeds, so the application must retain the existing per-minute
  transaction cost.
- Higher real-time throughput can expose existing presentation or host
  performance limits; those are separate rendering work, not a reason to
  weaken temporal correctness.

## Alternatives rejected

### Jump the authority by the playback multiplier

Rejected because it skips GameMinutes, boundary evaluations, transport
quanta, and deterministic event order.

### Make catch-up unbounded

Rejected because a large stall could monopolize the main thread.

### Drop surplus elapsed budget

Rejected because it makes wall-clock playback non-deterministic and loses
simulation time.

### Persist playback state

Rejected because the accumulator is transient wall-clock state, not world
authority or save data.

## Enforcement

- Deterministic `simulation-runtime` tests cover each rate and the cap.
- Game integration tests cover ordered five-phase commits, revision `+5`,
  and multi-minute rejection.
- Calendar and WorldSave tests prove no T4.1 persistence or projection
  changes.
- Targeted browser evidence covers the unchanged controls and playback
  behavior when the PR is finalized.

## Supersession boundary

ADR-0005 remains the historical authority for the compressed calendar and
its other decisions. This ADR supersedes only its old playback-throughput
table.

