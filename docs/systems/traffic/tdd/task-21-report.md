# Task 21 — Targeted browser authority evidence

## Scope

Task 21 owns only the targeted browser authority assertions. No Traffic, Simulation, Save, fixture-runtime, or Three.js production behavior was changed.

## Browser assertion changes

- `citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts` now requires the read-only browser snapshot to expose `absoluteGameMinute`, a versioned Traffic transport cursor, active trip IDs/statuses/Drive phases, per-trip and summary queue/reservation facts, materialized trip IDs, and an absent-or-zero replay count.
- `citizen-mobility-traffic-save-load.@traffic@release.spec.ts` now specifies WorldSaveV8 restoration of the minute calendar, Traffic cursor, lifecycle/resource identity, and materialized-ID/replay invariants.
- `citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts` now requires recovery to preserve an active Drive phase/resource facts and to materialize only still-authoritative trips with no replay.

The assertions intentionally use the public `__WEB_THREE_CITY_TRAFFIC__` test API. They do not treat Three.js object state as simulation authority and do not add browser-side domain workarounds.

## TDD status

The assertion changes are the RED browser contract. No production code was added or modified by this task. The browser run is intentionally deferred until Game compiles, as required by Task 21.

## Verification evidence

Run under Node 22 (the repository requires it):

```text
pnpm typecheck:browser
PASS

pnpm exec prettier --check \
  browser-tests/citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts \
  browser-tests/citizen-mobility-traffic-save-load.@traffic@release.spec.ts \
  browser-tests/citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts
PASS

git diff --check -- <the three Task 21 browser specs>
PASS
```

The attempted focused Game unit command was:

```text
pnpm --filter @web-three-city/game test -- \
  traffic-authoritative-short-trip.test.ts traffic-transport-transaction.test.ts
```

It collected the Game suite and failed with 59 existing migration failures. The leading failures are `RangeError: simulation-snapshot:invalid-game-minute` in legacy `absoluteTick` setup and missing Traffic-presentation lifecycle fields. This task did not change those files.

The direct compile gate was:

```text
pnpm --filter @web-three-city/game typecheck
FAIL
```

Exact primary blocker: the migrated `SimulationSnapshot` has `absoluteGameMinute`, but Game still references `absoluteTick`. Representative errors include:

```text
apps/game/src/main.ts(262,38): Property 'absoluteTick' does not exist on type 'SimulationSnapshot'.
apps/game/src/traffic-release-fixture.ts(241,5): 'absoluteTick' does not exist in type 'SimulationSnapshot'.
apps/game/src/game-world-tick.ts(69,42): Property 'absoluteTick' does not exist on type 'SimulationSnapshot'.
```

There are also three independent `exactOptionalPropertyTypes` errors in `packages/traffic-core/src/traffic-quantum.ts` where an explicit `TrafficScaleInstrumentation | undefined` is supplied to an optional property.

## Browser gate

Not run: `pnpm --filter @web-three-city/game test:browser:targeted`.

The Game compile failure prevents creating the browser artifact safely. In the current worktree, `apps/game/package.json` also has no `test:browser:targeted` script; after the compile blockers are resolved, invoke the repository’s intended targeted Chromium command (or add its separately-owned script) only after confirming the current package topology.

## Residual risks and handoff

- The public browser debug surface and release fixture still need to publish the asserted read-only facts. This is intentionally outside Task 21’s browser-only scope.
- The exact fixture timing and resource states must be confirmed by the first Chromium RED run once Game compiles; no synthetic replay fallback is permitted to satisfy these assertions.
- The wider worktree contains unrelated in-progress changes that were preserved.
