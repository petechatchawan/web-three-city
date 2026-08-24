# Traffic Foundation v0.1 — PR11 Browser Performance Evidence

Status: **LOCAL R1/R2 STRUCTURAL GREEN; RELEASE FRAME FLOOR BLOCKED**

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

The source-tested candidate is `5ad9fa9720140e3b2dbb14cf0401b76e59bcc967`.
Documentation is intentionally recorded separately from that source-tested
SHA. The local implementation consists of:

- `539b9bc` — bounded Traffic instanced presentation;
- `3ec0f16` — deterministic `2×2` Road render-page batching;
- `5ad9fa9` — bounded old/new Traffic materialization overlap during camera
  reconciliation.

Traffic and Road authority, logical trip count, presentation caps, inspect
identity, motion semantics, Road chunk ownership, dirty rebuild behavior, and
save boundaries remain unchanged. The focused structural RED/GREEN tests are
in `traffic-three/test/traffic-instanced-presentation.test.ts` and
`road-three/test/road-render-page-presentation.test.ts`.

Fresh structural evidence on the source-tested build:

- Traffic render calls were `143` per frame after the fixture settled, versus
  the D2 all-scene baseline of `845`; the paused fixture still contained all
  `5,000` logical active trips, `279` visible vehicles, and `50` visible
  pedestrians.
- The targeted `@traffic|@road` Chromium subset passed `60/60`.
- Paused 414×896 release measurement over 120 frames: p50 `50.0ms`, p95
  `50.1ms`, max `50.2ms`, `28` frames over `33.4ms`, `7` over `50ms`, and
  `0` over `100ms`; draw-call p50/p95/max was `143/143/143`.
- A 30-frame x1 diagnostic sample ended with the fixture's active trips
  exhausted, so it is not admissible as steady-state release evidence. Its
  draw-call count was also `143`; no x1 PASS is claimed.

The hard release floor `p95 <= 33.4ms` therefore remains **not met** on the
fresh paused Traffic fixture. The pathological paused hitch criterion was
met (`>100ms = 0`), but the approved guardrail requires stopping before any
R3 work or push. Exact-head CI and Sonar were not run because no candidate was
pushable.

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

- Candidate SHA: **PENDING FINAL R6 HEAD**
- Focused Traffic/Traffic-three result: **PENDING FINAL HEAD**
- Lean CI / `pnpm check`: core GREEN passed on intermediate remediation head `059d57450138fa36d7823f98169b99a48cdf616b` in CI #1598 / run `31975215952`; final R6 head re-verification pending
- Targeted Browser result: **PENDING FINAL HEAD**
- Browser evidence artifact ID: **PENDING FINAL HEAD**
- Sonar/quality result on same SHA: **PENDING FINAL HEAD**
- 5,000 logical Traffic fixture: **PENDING FINAL R6 HEAD** (previous candidate passed)
- 20,000-Citizen fixture: **PENDING FINAL R6 HEAD** (previous candidate passed)
- Presentation architectural budget: implementation + focused test written; **PENDING FINAL R6 HEAD verification**

## Manual visual acceptance

Owner visual acceptance at 414×896 remains a separate mandatory gate and is **FAIL / PENDING OWNER RE-TEST** after the new exact candidate is automated-green. Automated performance evidence does not substitute for visual acceptance of scale, real pedestrians/cars, queues, Inspect, Traffic overlay, or 4× peak-flow readability.
