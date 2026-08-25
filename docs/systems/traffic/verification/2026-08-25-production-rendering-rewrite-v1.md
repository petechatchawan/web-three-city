# Production Rendering Rewrite v1 Verification

Status: **STRUCTURAL GREEN; METAL RELEASE RETEST REQUIRED**
Date: 2026-08-25
Branch: `feat/motion-junction-realism-v1`
Source-tested SHA: `346b4a93a2d724cc2a0c95297743979c0c9935dc`
Documentation closure: docs-only commit after the source-tested SHA

## Implemented local slice

- Traffic Near/Mid spatial InstancedMesh regions with packed active slots,
  deterministic bounds, shared unlit resources, unchanged-transform upload
  suppression, low-poly Near pedestrian heads, and explicit disposal.
- Road `4×4` render pages use a shared unlit front-facing committed material,
  remain frustum-cullable presentation resources, and compact planar cell
  surfaces to one spine plus only necessary non-overlapping arms.
- Runtime Traffic presentation skips unused edge-flow projection while Traffic
  Inspect keeps the full-flow default.
- The release fixture creates 5,000 valid logical routes without U-turn-only
  candidates and exposes renderer/Traffic/Road structural counters.

## Fresh deterministic evidence

- `pnpm --filter @web-three-city/traffic-three test`: 8 files, 40/40 GREEN.
- `pnpm --filter @web-three-city/traffic-three typecheck`: GREEN.
- `pnpm --filter @web-three-city/road-three test`: 9 files, 40/40 GREEN.
- `pnpm --filter @web-three-city/road-three typecheck`: GREEN.
- focused 5,000-trip Game fixture: 1/1 GREEN.
- focused rerun of four initially resource-contended Game files: 4 files,
  17/17 GREEN.
- sequential full Game: 98 files, 401/401 GREEN; typecheck GREEN.
- `pnpm --filter @web-three-city/terrain-lab typecheck`: GREEN.
- targeted structural Chromium release fixture: 1/1 GREEN (fresh run after
  the source checkpoint).
- targeted Chromium Traffic commute + Road visibility: 3/3 GREEN (1.2m).
- browser-test typecheck and Game/Terrain Lab production builds: GREEN.
- ESLint, Prettier check, and `git diff --check`: GREEN.

The final production build after planar Road compaction reports `129` renderer
calls, `52,034` triangles, four committed Road pages, and 5,000 logical Traffic
trips in the structural 414×896 fixture. The preceding spatial/unlit build
reported `63,542` triangles, so this bounded slice removes another `11,508`
triangles without changing Road occupancy, Terrain sampling, logical chunks,
dirty-page ownership, Traffic caps, or Traffic authority. The Road geometry
RED observed end/straight/corner/T/four-way/ramp counts of `4/6/6/8/10/6`
against budgets of `2/2/4/4/6/2`; GREEN passes the budgets, deterministic
goldens, projected-footprint area, shared-port, full `road-three` 40/40, Road
visibility pixels, and affected Game 401/401 checks.

The first parallel full-Game run produced five 5-second timeouts while several
package/typecheck jobs competed for the same host. The same four files passed
17/17 in isolation, and the sequential full Game suite then passed 396/396;
there was no assertion-level regression.

## Release authority status

### Indexed Traffic flow prerequisite

Source audit found that `createTrafficEdgeProjections()` performed two complete
trip scans for every graph edge. The F1 RED used 5,000 trips and 5,001 edges:
the exact-reference parity test passed, while the scale test took `44.2s` and
failed because no bounded-work evidence existed. The GREEN implementation
indexes active current-edge load and queued Drive delay in one trip pass, then
projects each graph edge once. The same focused two-file suite completed in
`1.63s`; instrumentation reported exactly `5,000` trip visits and `5,001` edge
visits. Canonical ordering, congestion arithmetic, cost-field output, Traffic
authority, and persistence are unchanged.

Fresh post-F1 deterministic evidence:

- `traffic-core`: 15 files, 68/68 GREEN; typecheck GREEN;
- `traffic-three`: 8 files, 38/38 GREEN; typecheck GREEN;
- `road-three`: 9 files, 40/40 GREEN; typecheck GREEN;
- affected Game fixture/temporal tests: 5 files, 16/16 GREEN;
- full Game: 98 files, 401/401 GREEN; typecheck GREEN;
- structural 5,000-trip Chromium fixture: 1/1 GREEN (`13.9s`).

### Remaining x1 blocker

The full Chromium release scenario was attempted twice after the fixture and
projection remediation. In both attempts the fresh x1 fixture installed and
`setSpeed('normal')` executed, but the first temporal minute blocked the main
thread and the revision/GameMinute progress observation did not complete within
30 seconds. After indexed Traffic flow, the fresh hard-gate run still failed at
the same progress assertion, although total test duration fell from
approximately `7.5m` to `4.5m`. This proves that the quadratic flow projection
was a real scale defect but not the only first-minute blocker.

### F2 temporal-copy attribution and bounded fix

A deterministic first-minute diagnostic on the same 5,000-trip fixture showed
that a GameMinute plan took `241.3ms` in the first measured run. The four
Traffic transaction plans took `82.9ms`, `86.6ms`, `85.5ms`, and `90.3ms`;
their corresponding authority advances took `65.1ms`, `37.0ms`, `34.5ms`, and
`38.0ms`. Standalone V2 snapshot normalization was `11.1–17.2ms` per copy,
while already-memoized fingerprint reads were below `0.1ms`.

Source attribution found one avoidable application-layer V2 normalization
after every canonical Traffic quantum even when every trip remained Active.
The focused RED observed one redundant `createTrafficSnapshotV2()` call where
zero was required. The GREEN transaction reuses the canonical advanced
snapshot when no terminal trip requires Mobility settlement, while retaining
normalization for the terminal-removal path. Focused Traffic transaction,
terminal settlement, temporal parity/cadence, GameMinute, and release-fixture
verification passed 6 files / 18 tests; Game typecheck, focused ESLint,
Prettier, and `git diff --check` passed.

The fresh hard release test after this bounded fix did not complete its six
600-frame runs before the unchanged `600,000ms` test timeout. Trace evidence
shows that x1 revision/GameMinute progress did occur (the UI reached `11:01`),
so this run is no longer classified as a first-minute no-progress failure.
Instead, completed sampling windows showed severe frame-delivery cost: one
600-frame paused window consumed approximately `51.7s`, one 600-frame x1
window consumed approximately `107.8s`, and the following 120-frame x1 warm-up
consumed approximately `40.4s` before the test timed out during its next
600-frame sample. The test could not emit a complete percentile artifact, so
no p95 or hitch PASS is claimed.

The approved Hybrid Mobile Renderer work addresses presentation only: spatial
packed Traffic batches, unlit bounded archetypes, four Road render pages, and
planar Road geometry compaction. No authority, scheduler, timeout, fixture
scale, pixel ratio, shadow setting, or release threshold was changed.

No timeout was widened and no Traffic authority, Mobility, scheduler, caps,
Road density, pixel ratio, shadows, or release threshold was changed to conceal
the failure. The approved presentation rewrite does not authorize remediation
of the temporal authority hotspot.

Final release measurement has not yet been admitted. The explicit Metal
authority runs on this M4 were performed while unrelated user-owned Chrome,
VS Code, Zed, and WindowServer processes were active; host load was above the
10 logical CPUs. Three paused windows reported p95 `66.7ms`, `50.4ms`, and
`50.1ms`, with `>100ms` counts `17`, `3`, and `4`. These samples cannot
establish application PASS or FAIL. SwiftShader remains correctness authority,
not product-performance authority. The agent did not terminate user-owned
processes or average contaminated runs into a PASS.

Consequently:

- paused/x1 Metal `p95 <= 33.4ms`: **NOT ESTABLISHED**;
- recurring `>100ms` criterion: **NOT ESTABLISHED for x1**;
- `pnpm check`: **GREEN** at source SHA `346b4a9`;
- default SwiftShader structural browser evidence: **GREEN**;
- push, exact-head CI, Sonar, and Owner Visual retest: **BLOCKED pending
  uncontended Metal release evidence**.

## Required final run

Run from a quiet M4 session with no competing benchmark/browser workload:

```bash
WEB_THREE_CITY_ANGLE_BACKEND=metal \
WEB_THREE_CITY_PERFORMANCE_AUTHORITY=metal \
WEB_THREE_CITY_PERFORMANCE_RUNS=3 \
pnpm exec playwright test \
  browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts \
  --grep "414x896 release Traffic frame floor" --workers=1 --retries=0
```

The run must cover paused and fresh x1 fixtures, retain 5,000 logical trips,
show positive revision/GameMinute deltas for x1, and satisfy the unchanged
`p95 <= 33.4ms` and no-recurring-`>100ms` criteria for every admitted run.

The workspace uses Node `v20.20.2` while the repository declares Node `>=22`.
Commands reported the engine warning; this record does not infer that warning
caused the x1 blocker.
