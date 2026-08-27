# Playback Scheduler vNext

**Status:** Accepted for T4.1 implementation
**System:** `simulation-time` / `apps/game`
**Date:** `2026-08-27`

## Purpose

Increase the amount of simulation time advanced per real second while
preserving the single temporal authority, one-minute transaction boundary,
and existing domain-time semantics.

This specification changes only the application-owned conversion from wall
clock elapsed time to requests for authoritative GameMinutes.

## Playback presets

The existing `SimulationSpeed` values and UI labels remain unchanged:

| Preset | Throughput | Real time per GameMinute |
| --- | ---: | ---: |
| `paused` | 0 GameMinutes/s | no automatic requests |
| `normal` / x1 | 2 GameMinutes/s | 500ms |
| `fast` / x2 | 4 GameMinutes/s | 250ms |
| `faster` / x4 | 8 GameMinutes/s | 125ms |

The labels are relative presets. `fast` is twice `normal`, and `faster` is
four times `normal`; they are not renamed to x2/x4/x8.

## Temporal authority

`AbsoluteGameMinute` remains the sole mutable world-calendar authority.
Playback must never add more than one minute to authority in a single
transaction and must not skip intermediate minutes.

Every requested minute retains the existing ordered phases:

```text
GameMinute -> Q1 -> Q2 -> Q3 -> Q4
```

Every successful minute preserves the existing revision delta of `+5` and
the existing Traffic four-quanta cadence. Calendar projections, Growth,
construction durations, RCI, Economy, Mobility, Traffic, routing, and
WorldSave persistence are not redesigned by T4.1.

## Scheduler accumulator and bounded work

The runtime accumulator stores unconsumed real elapsed milliseconds. For a
running preset, each minute consumes its preset interval. `advance()` may
process at most eight complete GameMinutes per call.

The processing cap is per call, not a cap on accumulated budget. Surplus
budget remains available to later `advance(0)` or ordinary frame calls. The
scheduler is bounded and never drains an arbitrarily large stall in one
call.

Changing speed and resetting after visibility changes clear pending wall
clock accumulation, as in the existing runtime contract. Paused advances do
not accumulate elapsed time.

## Rejection and step semantics

Each minute is independently atomic. If a multi-minute advance commits two
minutes and the third minute rejects:

- the first two committed minutes remain committed;
- no later minute is attempted;
- the rejected minute has no partial externally visible commit;
- accumulated playback time is cleared;
- playback enters `paused-world-rejected`;
- the typed failure remains observable; and
- the rejected minute is not silently retried.

When paused, `step()` requests exactly one complete minute and does not use
the automatic playback rate. While running, `step()` remains unavailable.

## Persistence and UI

Playback speed and the transient accumulator are runtime state only. They are
not persisted. The WorldSave writer remains V8 and the numeric
`AbsoluteGameMinute` payload is unchanged.

The controls remain Pause, Play/normal, 2×, and 4×. No control relabeling or
UI redesign is part of T4.1.

## Acceptance

Deterministic runtime tests must prove the four rate policies, pause and
step, frame-sliced equivalence, bounded backlog retention, speed/visibility
reset, ordered phase emission, and multi-minute rejection stop behavior.
Game integration tests must prove earlier successful world commits remain
present when a later minute rejects, with `+5` revision per successful
minute. Existing calendar rollover, WorldSave V8, domain, and browser
behavior tests remain green.

