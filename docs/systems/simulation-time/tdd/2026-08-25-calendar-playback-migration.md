# Simulation Calendar and Playback Migration — TDD Plan

> **Status:** Deferred. ADR 0004 is Proposed, not Accepted. Luna Max must not execute this plan without explicit owner approval after balance analysis.

**Goal:** If approved, move to a compressed city-builder calendar and new real-time playback pacing while preserving one world timeline and all domain durations.

**Architecture:** Calendar is a projection from `AbsoluteGameMinute`; playback converts real elapsed time into requests for atomic GameMinutes. No subsystem gains a private clock. Transport quanta remain authority phases inside one minute transaction rather than wall-clock events.

## Proposed contract requiring approval

- 60 GameMinutes = one GameHour.
- 24 GameHours = one CalendarMonth/cycle.
- 12 CalendarMonths = one CalendarYear.
- x1 = 3.000 real seconds/GameMinute; x2 = 1.500; x4 = 0.750.
- Speed changes pacing only, never domain durations.

## Mandatory precondition: balance impact report

Before RED tests, inventory every duration and calendar consumer in Building, RCI, Economy, Mobility, Traffic, Seasons, statistics, and Save. Compare current 360-day-year behavior with the proposed 12-cycle year. In particular, quantify citizen aging and Economy settlement. If preserving gameplay requires product rebalance, stop for owner approval; do not hide a 30× semantic acceleration inside calendar projection code.

## Task 1: Lock calendar projection examples

Add RED simulation-core tests for:

- January `23:59 →` February `00:00`;
- December Year 1 `23:59 →` January Year 2 `00:00`;
- monotonic `AbsoluteGameMinute` across both boundaries;
- calendar projection round-trip where supported;
- no mutable month/year/hour authorities.

Implement only in `simulation-core` after ADR acceptance.

## Task 2: Lock playback pacing

Add RED simulation-runtime tests using a fake monotonic clock. Assert exact request counts at x1/x2/x4, pause behavior, visibility reset, accumulator carry, and rejection clearing. Domain durations must be identical across speeds.

Do not distribute GameMinute/Q1–Q4 commits across separate rAF frames. Visual interpolation may use sub-minute progress, but it cannot become authority.

## Task 3: Rebalance or preserve domain schedules explicitly

For each affected domain, choose and document one of:

- retain absolute macro-hour duration;
- translate former day/month/year intent to the compressed calendar;
- introduce a separate named duration concept.

Every choice needs deterministic RED/GREEN tests and Save migration impact. No implicit formula substitution is allowed.

## Task 4: Browser acceptance

Add targeted browser coverage for Pause/x1/x2/x4 over hour, month, and year boundaries, including Growth, RCI, Economy, Mobility, Traffic, and rejection behavior. Verify UI calendar labels and no `Applying change` stall.

## Task 5: Release verification

This is an application-wide behavior and Save-facing milestone. Run all affected package owners/consumers, targeted browser ownership tags, `pnpm test:deployment`, `pnpm verify`, and `pnpm verify:full`. Record exact-head CI, Sonar, and Owner Visual. Do not merge without explicit authorization.
