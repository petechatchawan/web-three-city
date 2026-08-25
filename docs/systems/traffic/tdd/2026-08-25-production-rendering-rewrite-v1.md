# Production Rendering Rewrite v1 TDD Plan

Status: IMPLEMENTED LOCALLY; RELEASE AUTHORITY RETEST REQUIRED
Date: 2026-08-25

## Goal

Reduce Traffic/Road GPU-facing presentation pressure without changing gameplay
authority, logical scale, materialization caps, or Road chunk ownership.

## RED/GREEN slices

1. Traffic spatial batches
   - RED: many agents and region/tier moves require bounded render batches,
     packed active counts, stable identity, independent transforms/colors,
     compaction, reuse, and exactly-once disposal.
   - GREEN: region/tier-owned shared InstancedMesh batches with deterministic
     bounds and packed slots.
2. Road mobile-cost committed presentation
   - RED: committed render pages remain bounded, named, frustum-cullable, and
     retain page identity/disposal rules.
   - GREEN: four bounded `4×4` pages with a shared unlit, front-facing
     committed material on existing render-page geometry.
3. Mobile GPU work budget
   - RED: unchanged instance transforms republish GPU buffers; Near pedestrian
     geometry uses 92 triangles; Road remains 16 render submissions.
   - GREEN: unchanged transforms do not bump instance-buffer versions, Near
     pedestrians use at most 24 triangles, and Road uses four render pages.
4. Road planar geometry budget
   - RED: end/straight/corner/T/four-way and valid ramp cells emit redundant
     coplanar subdivisions above topology-specific triangle budgets.
   - GREEN: one planar spine plus non-overlapping arms preserves exact projected
     footprint area, Terrain sampling, deterministic golden output, and shared
     neighbor ports while reducing dense-fixture triangles.
5. Runtime Traffic projection
   - RED: a presentation-only projection must preserve rendered active agents
     without paying for unused edge-flow derivation; full projection remains the
     default for Inspect.
   - GREEN: direct active-agent projection, per-call route memoization, and one
     Road-cell lookup.
6. Release fixture
   - RED/GREEN workload contract: 5,000 valid logical trips, unchanged caps,
     spatial counters, fresh paused/x1 fixtures, 600 raw rAF samples.
   - Release threshold remains an acceptance gate rather than a unit-test
     substitute. It is enforced only for an explicitly selected Metal
     performance-authority run; default SwiftShader browser runs remain
     correctness/structural evidence.

## Verification order

```text
traffic-three focused/full
→ road-three focused/full
→ Game focused/full
→ owner and Level-2 typechecks/builds
→ targeted @traffic|@road browser
→ paused/x1 release authority
→ repository final gate only after the release candidate is GREEN
```

Intentional RED is never pushed. The latest Metal samples were host-contended
and therefore do not establish either PASS or FAIL; an uncontended Metal
paused/x1 run is required before push, exact-head CI, Sonar, and Owner Visual
handoff.
