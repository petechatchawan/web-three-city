# Roads System

**Status:** Road Type Authority v1, PR2 Road Presentation, PR3 Lane-aware Traffic, and PR3.1 Motion & Junction Realism implemented; PR3.1 release/owner visual gate pending  
**Base:** `master@377ea016a0c537f57aa2cfff27bd622e03a6b060` after PR3 Lane-aware Traffic  
**Verification:** exact-head/release evidence belongs in PR #83 metadata, not this living handoff  
**Primary ownership:** `packages/road-core`, `packages/road-three`, `apps/game` tool integration  
**Persistence:** `RoadSaveV1`

## Purpose

Own authoritative Road occupancy and Road definition identity, deterministic stroke mutation/replacement, cardinal connectivity, terrain/ramp validity, rendering input, and Road access consumed by Zoning and Building development.

## Does Not Own

- Terrain or Water state.
- Zoning rights or Building occupancy.
- Traffic routing, differentiated speed/capacity, lane movement, congestion, or vehicle ownership.
- Population access or commute simulation.
- Renderer meshes or lane-marking geometry as authority.

## Current Capabilities

- Canonical Road definition catalog with stable monotonic codes:
  - `1` — `basic-road` / Local Street — width `0.72`
  - `2` — `collector-road` / Collector Road — width `0.82`
  - `3` — `arterial-road` / Arterial Road — width `0.92`
- Build a Road on an empty cell.
- Replace an occupied Road cell with a different Road definition as one Road transaction without changing occupancy.
- Treat a same-definition build as `road:no-change`.
- Bulldoze any occupied Road definition back to empty.
- Drag strokes with reversible tail erase during preview for the existing game Road workflow.
- Place on flat terrain and supported single-axis ramps.
- Reject wet cells, invalid terrain, invalid ramp topology, incoherent revisions, malformed snapshots, and unknown Road definition codes.
- Derive N/E/S/W connection masks and rebuild cells whose connectivity or Road definition changed.
- Persist definition bytes through the existing `RoadSaveV1` shape and reconstruct derived rendering after load.
- Provide Road occupancy/access inputs to Zone and Building systems.
- Participate in Terraform and Zone occupancy guards.
- Derive data-driven Local / Collector / Arterial Road presentation with definition-specific carriageway widths and semantic center-divider geometry.
- Draw deterministic terrain-conforming curved center-divider geometry through simple N+E / E+S / S+W / W+N 90-degree Road corners.
- Keep curved center-divider triangles consistently upward-facing and render divider color as semantic white so corner markings do not darken from reversed face winding.
- Keep T-junction and four-way interiors intentionally unmarked until later Traffic Control semantics exist.
- Expose Local Street / Collector Road / Arterial Road / Bulldoze through the compact Road Build workflow.
- Preserve Road definition codes `1/2/3` into the Traffic source projection while deriving Traffic cardinal connectivity from any occupied Road type.
- Feed Traffic profiles where Local / Collector / Arterial have increasing free-flow speed and capacity while Road remains the authority for definition identity and carriageway width.
- Support Traffic-derived left-hand directional lane paths whose visual offset follows the committed Road width without turning lane geometry into Road state.

### Render-page batching

The local PR #83 remediation keeps logical Road chunks as the authority,
dirty/rebuild ownership, interaction unit, and persistence boundary. Committed
Road presentation groups neighboring logical chunks into deterministic `2×2`
render pages and merges the existing chunk-derived `RoadMeshData` for each
page. A dirty logical chunk rebuilds only its owning page; multiple dirty
chunks in one page are coalesced, and unaffected page identities/resources are
retained. Render pages are presentation-only and are never persisted or used
as Road authority.

## Ownership and State

`RoadSnapshot.definitionCodes` and Road revision are authoritative. One byte-sized definition code exists per world cell. Road definition IDs/codes are catalog authority; connection masks, cell views, meshes, lane geometry, preview geometry, Road-access projections, Traffic graphs, Traffic lane paths, motion curves, and vehicle transforms are derived.

Stable Road codes are compatibility contracts. A retired numeric Road code must never be reused for a different Road meaning.

## Mutation Semantics

```text
empty + Road type     → create
different Road type   → replace / upgrade
same Road type        → no-change
bulldoze              → empty
```

A replacement increments Road revision and marks the target as topology/presentation changed even when its cardinal connection mask is unchanged. Replacement does not count as an added or removed occupied Road cell.

## Main Workflow

1. Input provides an ordered canonical cell stroke and selected `RoadDefinitionId`.
2. The planner validates Road state, Terrain/Water revision coherence, cells, and the selected Road definition.
3. It derives proposed definition bytes, added/removed occupancy, definition/connectivity changes, and dirty chunks.
4. Commit rechecks base revisions and reconstructs the proposed state before mutation.
5. Commit rejects changes outside the requested cells or derived topology that does not match the plan.
6. Renderer and dependent environments rebuild from the committed snapshot.

## Integrations

```mermaid
flowchart LR
  Terrain --> Roads
  Water --> Roads
  Roads --> Zoning
  Roads --> Buildings
  Roads --> TerraformGuard[Terraform guard]
  Roads --> RoadRenderer[Road presentation]
  Roads --> TrafficProjection[Traffic source projection]
  TrafficProjection --> TrafficCore[Traffic edge routing]
  TrafficCore --> LanePath[Derived directional lane path]
  LanePath --> MotionPath[Prepared line/cubic motion path]
  Roads --> WorldSave
```

Road definition identity remains a Road concern. The Game Traffic source projection preserves codes `1/2/3` and treats every non-empty Road definition as connected Road occupancy. `traffic-core` owns differentiated free-flow speed/capacity and keeps canonical routing edge-based. `traffic-three` derives production left-hand lane centerlines plus deterministic line/cubic junction motion geometry from that canonical route. Road width and Road connection masks supply derived presentation geometry only; Traffic lane/motion state is not persisted back into Road.

## Persistence

`RoadSaveV1` remains schema version `1`. It stores dimensions, Road revision, and base64-encoded `Uint8Array` definition codes. Codes `0`, `1`, `2`, and `3` round-trip through the existing wire shape; legacy saves containing only `0/1` remain compatible. Connectivity, lane/marking geometry, Traffic lane paths, motion paths, and meshes are never persisted and are rebuilt.

## Invariants and Failure Behavior

- Exactly one Road definition code per world cell.
- Valid canonical codes are currently `0..3`; unknown codes fail closed.
- `basic-road` remains canonical code `1` for compatibility.
- Road snapshots match world dimensions.
- Placement environments use coherent Terrain and Water revisions.
- Connectivity is derived from cardinal neighboring occupied Road cells, regardless of whether the occupied neighbor is Local, Collector, or Arterial.
- Traffic projection preserves Road definition identity; it does not collapse codes `2/3` back to Local code `1`.
- Traffic differentiation never makes Traffic profile values part of Road authority.
- A Road definition replacement marks the target changed even when occupancy/connectivity is unchanged; active canonical Traffic trip identity remains stable while its derived lane/motion presentation can be re-prepared.
- Curved corner markings are presentation-only and derive from exact two-bit orthogonal Road connectivity plus the Road style profile.
- Curved center-divider mesh triangles must have upward geometric winding consistent with their `+Y` normals, and the semantic divider color is white for straight and curved segments.
- T/four-way junction interiors remain unmarked in PR3.1; decorative lines must not imply nonexistent priority/signal semantics.
- Invalid or stale plans do not mutate state.
- Road renderer/Traffic consumers cannot become Road authority.

## Road Lane & Vehicle Life Realism v1

The approved production program is specified in:

- `specs/2026-08-17-road-lane-vehicle-life-realism-v1.md`
- `tdd/2026-08-17-road-lane-vehicle-life-realism-v1.md`
- `specs/2026-08-19-motion-junction-realism-v1.md`
- `tdd/2026-08-19-motion-junction-realism-v1.md`

The implementation order remains staged:

```text
PR1 Road Type Authority
→ PR2 Lane Geometry + Road Presentation
→ PR3 Lane-aware Traffic
→ PR3.1 Motion & Junction Realism
→ PR4 Vehicle Life Authority
→ PR5 Mobility Assignment + WorldSaveV8
→ PR6 Persistent Parking + Vehicle Presentation
→ PR7 Release Verification
```

PR3 keeps canonical Traffic routing edge-based and derives only presentation lane geometry. Production handedness is left-hand traffic. Each current single-cell two-way Road exposes one directional travel lane per direction for presentation; opposing trips therefore occupy opposite physical sides of the carriageway.

PR3.1 preserves that authority boundary while replacing visibly angular turn slices with prepared cubic motion geometry, tangent-aligned heading, and presentation-only acceleration/deceleration/turn-speed smoothing. Road corner markings follow simple 90-degree bends with upward-facing white divider geometry; T/four-way interiors remain intentionally clear.

## Current Limitations

Local / Collector / Arterial now have distinct Road presentation plus differentiated Traffic speed/capacity and lane-aware motion presentation. The current Road footprint is still one gameplay cell wide and supports one directional travel lane each way. Curved marking support is intentionally limited to simple 90-degree two-connection corners. There are still no one-way Roads, multi-cell four/six-lane avenues, bridges, tunnels, lane changing/overtaking, traffic signals/stop controls, street-light props, transit, maintenance, or economic Road cost. Vehicle ownership and persistent parking remain PR4–PR6 work.

A real four-lane avenue must use a future multi-cell Road-footprint design rather than compressing four lanes into the current single Road cell.

## Handoff Checklist

- Canonical authority: `packages/road-core/src/contracts.ts`
- Snapshot validation: `packages/road-core/src/road-snapshot.ts`
- Mutation/replacement: `packages/road-core/src/road-mutation.ts`
- Persistence: `packages/road-core/src/serialization.ts`
- Renderer: `packages/road-three`
- Curved corner markings: `packages/road-three/src/road-corner-marking-geometry.ts`
- Traffic Road profiles: `packages/traffic-core/src/road-profile.ts`
- Game Traffic occupancy projection: `apps/game/src/traffic-source-projection.ts`
- Directional lane derivation: `packages/traffic-three/src/directed-lane-path.ts`
- Cubic junction connectors: `packages/traffic-three/src/intersection-lane-connector.ts`
- Prepared motion sampler: `packages/traffic-three/src/route-geometry.ts`
- Presentation kinematics: `packages/traffic-three/src/vehicle-motion-kinematics.ts`
- Game lane/motion projection: `apps/game/src/traffic-presentation-projection.ts`
- Related systems: [Terrain](../terrain/README.md), [Water](../water/README.md), [Zoning](../zoning/README.md), [Buildings](../buildings/README.md), [Traffic](../traffic/README.md)
- Historical foundation design: `docs/superpowers/specs/2026-07-29-road-network-foundation-v0-1-design.md`
