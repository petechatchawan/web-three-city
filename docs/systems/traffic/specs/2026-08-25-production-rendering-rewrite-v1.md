# Production Rendering Rewrite v1

Status: APPROVED / IMPLEMENTED LOCALLY / RELEASE AUTHORITY NOT GREEN
Date: 2026-08-25
Scope: PR #83 presentation only

## Problem

The 414×896 release Traffic fixture keeps 5,000 logical active trips. Earlier
work removed repeated temporal publication, duplicate Road-source derivation,
capacity-inflated Traffic instances, and per-chunk Road submissions. Those
changes preserve authority and reduce renderer work, but the absolute frame
floor must be evaluated on the selected hardware renderer rather than inferred
from a software rasterizer run.

## Design

Traffic rendering is spatially partitioned after the existing materialization
policy:

```text
committed Traffic snapshot
→ unchanged materialization policy
→ Near/Mid logical presentation handles
→ fixed-size spatial regions
→ packed InstancedMesh batches per region/tier/archetype
→ Three.js renderer
```

Each region batch submits only active packed slots. Near vehicles retain body
and roof parts and Near pedestrians retain body and head parts. Mid agents use
one bounded low-cost geometry. Shared unlit vertex-color materials and geometries are
owned and disposed once by the render set. Region bounds are deterministic and
support Three.js frustum culling without making visibility or render slots an
authority. An unchanged transform is not republished to the GPU instance
buffer, and the Near pedestrian head uses a bounded low-poly archetype while
retaining independent deterministic body/head colors.

Road presentation retains logical chunks as dirty/rebuild ownership. Existing
`4×4` render pages remain presentation-only; committed Road surfaces use a
shared unlit, front-facing vertex-color material and page geometry bounds for
frustum culling. Flat and axis-aligned ramp cells use a minimum non-overlapping
planar strip decomposition that preserves the canonical Road footprint and
Terrain sampling while reducing GPU triangles.

The Game runtime presentation does not need Traffic edge-flow information to
render agents. Its internal projection path therefore derives active agents
directly and skips the optional edge-flow projection. Traffic Inspect retains
the full-flow default. Route geometry is memoized only for one projection call,
and the Road-cell lookup is constructed once per projection.

## Frozen authority contracts

- Traffic Core, Road Core, Mobility, routing, trip lifecycle, scheduler,
  persistence, headway, junction arbitration, physical spacing, and canonical
  identity are unchanged.
- The 5,000-trip fixture, Traffic presentation caps, Near/Mid selection, camera
  policy, and Road density are unchanged.
- Render regions, instance slots, render tiers, meshes, materials, and flow-skip
  selection are derived presentation state and are never persisted.
- No pixel-ratio, shadow, quality, timeout, or release-threshold relaxation is
  part of this design.

## Deterministic acceptance

- Batch count grows with occupied regions/archetypes, not agent count.
- Each batch count equals its active packed cardinality.
- Region crossing and tier changes preserve identity, transform, and appearance.
- Releasing a non-final slot compacts the batch and updates the moved handle.
- Empty regions leave no renderable batch behind.
- Road pages retain bounded dirty-page rebuild and disposal semantics.
- Runtime no-flow projection returns the same agent presentation as the full
  projection while leaving full flow available to Inspect.

## Release authority and acceptance

The authority split is explicit:

- default Chromium/SwiftShader runs are deterministic correctness and
  structural browser evidence only;
- the product frame budget is measured on the representative M4/Metal
  hardware renderer with `WEB_THREE_CITY_ANGLE_BACKEND=metal` and
  `WEB_THREE_CITY_PERFORMANCE_AUTHORITY=metal`.

The Metal release workload remains Chromium at 414×896 with 5,000 logical
trips, 600 measured frames, `p95 <= 33.4ms`, and no recurring frames above
100ms for paused and then fresh x1 fixtures. The release test requires the
explicit Metal authority variable and is skipped for ordinary SwiftShader
correctness runs, so SwiftShader results are never presented as product FPS
evidence.

The latest local Metal measurements were not admitted as a release PASS:
three paused runs reported p95 `66.7ms`, `50.4ms`, and `50.1ms`, with host load
above the available CPU capacity and unrelated Chrome/IDE processes active.
They are evidence of an uncontended-run requirement, not a reason to weaken
the floor or change gameplay authority. A fresh uncontended paused + x1 Metal
run remains required before push/Owner Visual closure.
