# Traffic Foundation v0.1 — PR11 Browser Performance Evidence

Status: **LOCAL ACTIVE-INSTANCE STRUCTURAL GREEN; RELEASE PERFORMANCE BLOCKED**

This record covers both the existing logical Traffic scale evidence and the 2026-08-17 production remediation for owner-observed vehicle/Citizen scale and 4× render judder. Canonical Traffic/Mobility authority is unchanged.

## Deterministic workload

- Browser acceptance: `browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts`
- Canonical viewport: 414×896 portrait
- Logical Citizens: 5,000 real RCI Citizen IDs in the browser performance fixture
- Logical active Traffic trips: 5,000, mixed Walk/Drive
- Additional deterministic Citizen scale fixture: 20,000 Citizens
- Road graph: deterministic distributed grid across the committed world
- Presentation policy gates:
  - visible pedestrians <= 300
  - visible vehicles <= 300
  - full-detail Near agents <= 500
  - spatial candidate count < total logical trips
  - visited spatial buckets < total spatial buckets
  - camera leave/return increases pool reuse

The browser performance fixture is release/debug evidence only. Canonical Traffic and Citizen authority remain the committed snapshots; presentation caps, LOD, spatial indexing, pooling, visual scale, interpolation, and frame timing are derived concerns.

## Local R1/R2 render-batching checkpoint

The source-tested candidate is `9e0e81f1d1f770e53b13d6c462dd00825ab8f10e`.
Documentation is intentionally recorded separately from that source-tested
SHA. The local implementation consists of:

- `539b9bc` — bounded Traffic instanced presentation;
- `3ec0f16` — deterministic `2×2` Road render-page batching;
- `5ad9fa9` — bounded old/new Traffic materialization overlap during camera
  reconciliation.
- `9e0e81f` — packed active Traffic instance slots; backing capacity no longer
  determines submitted instance count.

Traffic and Road authority, logical trip count, presentation caps, inspect
identity, motion semantics, Road chunk ownership, dirty rebuild behavior, and
save boundaries remain unchanged. The focused structural RED/GREEN tests are
in `traffic-three/test/traffic-instanced-presentation.test.ts` and
`road-three/test/road-render-page-presentation.test.ts`.

The active-instance RED established that each Traffic batch submitted all `600`
allocated slots while only `279` vehicles and `50` pedestrians were active.
The GREEN implementation keeps active slots dense, sets each `InstancedMesh`
count to the active cardinality, and uses swap-last compaction while updating
the moved handle's identity-to-slot mapping. Focused tests also preserve moved
transform/color state, independent updates, release/reuse isolation, capacity
overflow, and exactly-once shared-resource disposal.

Fresh evidence on the source-tested build:

- Traffic batch counts were `279/279` for vehicle body/roof and `50/50` for
  pedestrian body/head, while backing capacity remained `600` per batch.
- Total render calls remained `143` per frame and triangles fell from the
  capacity-inflated combined result of `127,142` to `68,838`; the paused fixture
  still contained all `5,000` logical active trips, `279` visible vehicles, and
  `50` visible pedestrians.
- `traffic-three` passed `36/36`; the focused active-instance file passed
  `8/8`; affected Game presentation tests passed `17/17`; full Game passed
  `395/395`.
- `pnpm check` passed, including repository format/lint/typecheck/provenance,
  `60/60` deployment contracts, all workspace tests, and all builds.
- The targeted `@traffic|@road` Chromium subset passed `60/60`.
- The low-overhead paused 414×896 release measurement used Chromium
  `149.0.7827.55`, ANGLE SwiftShader, and exactly `600` measured rAF intervals:
  p50 `33.4ms`, p90 `50.0ms`, p95 `50.3ms`, p99 `116.9ms`, max `533.7ms`,
  `237` frames over `33.4ms`, `43` over `50ms`, and `8` over `100ms`.
- Revision and GameMinute deltas remained `0` throughout the paused sample.
- x1 was not measured because the paused workload already failed the release
  floor and pathological-hitch criterion; no x1 PASS is claimed.

The hard release floor `p95 <= 33.4ms` therefore remains **not met** on the
fresh paused Traffic fixture. The pathological paused hitch criterion is also
not met (`>100ms = 8`). The approved guardrail requires stopping before a
broader rendering rewrite or push. Exact-head CI and Sonar were not run because
no candidate was pushable.

## Traffic Presentation architectural budget

The Scale & Frame Pipeline Remediation adds a deterministic architectural performance gate rather than a device-specific FPS promise.

After presentation warmup with stable Traffic revision and camera context:

- repeated RAF frames must not rerun spatial/materialization/headway reconciliation;
- `reconciliationCount` remains stable until Traffic revision or materialization camera context changes;
- prepared routes are created/rebound only when a visual trip route is first bound or canonically changes;
- `preparedRouteCount` remains stable across repeated RAF frames and across progress-only canonical revisions on the same route;
- `frameSampleCount` advances on every render-frame sample;
- `lastFrameTimestampMs` is the real supplied render timestamp, not a synthetic `frameIndex * 16.667` clock;
- canonical input snapshots remain immutable while presentation advances through 1×/2×/4×-representative target cadence;
- pooled visual identity is stable after warmup and static appearance/scale binding is not repeated every frame;
- replay route-distance sampling uses prepared cumulative route data; no per-frame route-history `slice(...).reduce(...)` remains in the production replay path.

Absolute FPS is intentionally not hard-coded in CI because runner and target-device performance differ. Owner manual acceptance at 414×896 remains the final smoothness/readability gate.

## Visual scale budget

For the current basic rendered road width of `0.72` world units:

- vehicle width target is approximately `0.24` and must remain <= 40% of road width;
- vehicle length target is approximately `0.50` and must remain <= 85% of road width;
- pedestrian width target is approximately `0.08` and remains less than half vehicle width;
- deterministic visual size variants are bounded to ±5%;
- `traffic-three` owns ratios/policy only; the game adapter supplies the rendered road width and canonical Traffic remains unaware of visual scale.

## Measurements to record after final exact-head execution

The browser test captures three same-environment frame-duration samples and attaches `traffic-performance-measurements.json` containing:

- Playwright project/browser
- viewport
- logical Citizen/trip counts
- Traffic presentation debug counters
- median/min/max/spread for each sample run
- median of run medians
- JS heap observation when the browser exposes `performance.memory`

Timing remains observational unless repeated CI evidence proves a stable failure threshold. Deterministic workload/cap/spatial-work assertions and the RAF architectural budget remain the automated release gates.

## Exact-head evidence

- Local source-tested candidate SHA: `9e0e81f1d1f770e53b13d6c462dd00825ab8f10e`
- Focused/full `traffic-three`: `8/8` focused and `36/36` package GREEN
- Full Game: `395/395` GREEN
- `traffic-core`: `65/65` GREEN
- `road-core`: `31/31` GREEN
- `road-three`: `40/40` GREEN
- Local `pnpm check`: GREEN
- Targeted Browser `@traffic|@road`: `60/60` GREEN
- 5,000 logical Traffic paused fixture: workload/cardinality assertions GREEN;
  release performance BLOCKED by the measurements above
- Lean CI / Sonar / browser artifact: **NOT RUN — candidate not pushed because
  release performance gates failed**

## Manual visual acceptance

Owner visual acceptance at 414×896 remains a separate mandatory gate and is
**BLOCKED / RETEST REQUIRED ONLY AFTER AN AUTOMATED-GREEN CANDIDATE**. Automated
performance evidence does not substitute for visual acceptance of scale, real
pedestrians/cars, queues, Inspect, Traffic overlay, or 4× peak-flow readability.
