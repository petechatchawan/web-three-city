# Traffic System

**Status:** Traffic Foundation v0.1 + Road PR3 Lane-aware Traffic implemented; PR3 release gate/owner visual acceptance pending<br>
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Primary ownership:** `packages/traffic-core`, `packages/traffic-three`; atomic composition by `apps/game`<br>
**Persistence:** `TrafficSaveV1` inside `WorldSaveV7`

## Purpose

Own deterministic pedestrian/vehicle graph derivation, multimodal routing, logical trip progression, intersection queues, congestion/travel-time projections, route recovery, and Traffic persistence while keeping Road, Building, Citizen, Simulation and Three.js presentation authority separate.

The production goal is visual truth: a visible pedestrian is a real Citizen Walk trip and a visible car is a real Citizen Drive trip. Off-screen trips remain logical; renderer state never becomes canonical Traffic state.

For vehicle presentation, canonical Traffic progress and edge-route identity remain simulation authority. The renderer derives a left-hand directional lane path from the committed route, keeps a stable trip-to-pooled-vehicle mapping, interpolates transforms on render frames, and applies deterministic longitudinal visual headway without inventing lateral spread. Lane centerline position, junction connector sampling, heading, interpolation, arrival cleanup, and materialization are presentation state only and must never mutate canonical trip progress, queue order, Road state, or save state.

## Does Not Own

- Citizen identity, Household, Housing, Employment, migration, or RCI Demand.
- Citizen activity/schedule/trip-purpose authority.
- Road occupancy/connectivity or Building placement/frontage authority.
- Terrain/Water or Simulation clock authority.
- UI authority.
- Parking, car ownership, transit, bicycles, signals, accidents, freight, emergency vehicles, or ordinary congestion rerouting in v0.1.

## Authority Boundary

```text
Roads + Buildings + Simulation + Citizen Mobility
                    ↓
             apps/game projections
                    ↓
              traffic-core
       graphs + routes + trip progress
       queues + committed cost projection
                    ↓
             traffic-three
   directed lane path + junction connector
     materialization + pooling + LOD
                    ↓
       real pedestrians / real cars
```

## Implemented Traffic Core

`packages/traffic-core` now provides:

- strict Road/Building source projection contracts;
- immutable `TrafficSnapshotV1` + deterministic snapshot/graph fingerprints;
- versioned Traffic road profiles for Road definition codes `1/2/3` with PR3 differentiation:
  - Local Street: `8_333 mm/s` free-flow, capacity `16`;
  - Collector Road: `13_889 mm/s` free-flow, capacity `24`;
  - Arterial Road: `19_444 mm/s` free-flow, capacity `32`;
- deterministic directed vehicle graph and offset pedestrian sidewalk graph;
- frontage-only Building access mapping;
- deterministic shortest-path routing with explicit total-cost/traversal/node/edge tie rules;
- previous-committed `TrafficCostField` input for Drive candidate costs;
- disposable revision-keyed route cache;
- fixed-point `progressQ` trip progression with logical `lastStableNodeId`;
- deterministic unsignalized intersection queue service;
- load/capacity/congestion/effective-travel-time projections and next lagged cost field;
- topology/destination route recovery from a stable logical node;
- fail-closed `TrafficSaveV1` codec that persists route/progress/queue authority, never graph/cache/render state;
- no imports from RCI, Mobility, Road, Building, DOM, or Three.js;
- `apps/game` atomic integration with real Mobility trips, Road/Building projections, Simulation time, and deterministic Road-change recovery;
- Game Road source projection preserves canonical Road definition codes `1/2/3` and derives connectivity from non-empty Road occupancy across mixed Road types;
- `WorldSaveV7` persistence and V1–V6 migration, preserving logical route/progress/queue state without synthetic trips;
- `traffic-three` production left-hand `DirectedLanePath` derivation, deterministic straight/left/right junction connectors, pooled pedestrian/vehicle materialization, spatial indexing, deterministic caps, and LOD where every materialized agent resolves to a real Citizen-linked trip;
- Game presentation maps canonical edge progress onto the derived lane path, so opposing Drive directions occupy opposite physical sides of the Road while canonical route/trip identity remains unchanged;
- active trips re-prepare only their derived presentation route when Road width/type changes; canonical Mobility/Traffic identity is preserved;
- Citizen/Vehicle Inspect projections and the localized Traffic Information View consume committed state without mutating Traffic authority.

Flow policy v1 keeps zero-load time equal to free-flow and adds monotonic delay only when load exceeds edge capacity or queue wait exists. Ordinary congestion never reroutes an active trip; only topology/destination invalidation invokes recovery.

## Current Limitations and Extension Points

The current lane-aware model is deliberately bounded to one directional travel lane each way on the existing single-cell two-way Road footprint. There is no lane changing/overtaking, one-way Road behavior, U-turn generation, multi-cell four/six-lane avenue footprint, signals, roundabouts, parking, vehicle ownership, transit, freight, accidents, or ordinary congestion-triggered mid-trip rerouting. Road topology/destination invalidation can still recover or fail active trips deterministically; ordinary congestion does not reroute an active trip in v0.1.

Vehicle Life authority, persistent car ownership/parking, and concrete vehicle assignment remain PR4–PR6 work. The previously identified x4 world-tick/topology caching performance remediation is intentionally deferred from PR3 and should be handled as a separate performance change after the Traffic/Vehicle Life program unless release evidence requires earlier intervention.

## Performance Contract

- Logical scale gate: at least 20,000 Citizens and 5,000 concurrent trips.
- Materialized target budgets: up to 300 pedestrians, up to 300 vehicles, normal full-detail combined target 400–500 agents.
- No per-frame scan of all Citizens or world trips.
- Spatial indexes, pooling, LOD, route caching, and dirty-region graph rebuilds are required production mechanisms.

## Planning Documents

- [Traffic Foundation v0.1 specification](specs/2026-08-15-traffic-foundation-v0-1.md)
- [Traffic TDD implementation plan](tdd/2026-08-15-traffic-foundation-v0-1.md)
- [Traffic PR9 production hardening plan](tdd/2026-08-15-traffic-production-hardening-pr9.md)
- [Cross-system execution index](../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md)
- [World/Application integration plan](../world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md)
- [City UI integration plan](../city-ui/tdd/2026-08-15-citizen-traffic-inspect-information-view-v0-1.md)
- [ADR-0001 — Logical real trips with materialized visual agents](adrs/0001-logical-real-trips-materialized-visual-agents.md)
- [ADR-0002 — Derived transport graphs and lagged congestion costs](adrs/0002-derived-transport-graphs-and-lagged-costs.md)
- [Road Lane & Vehicle Life Realism v1](../roads/specs/2026-08-17-road-lane-vehicle-life-realism-v1.md)

PR3 release verification covers differentiated Road profiles, left-hand directional lane derivation, junction connectors, canonical-trip-preserving Road upgrades, deterministic 5,000-trip Traffic scale, and the targeted `@road|@traffic` browser ownership set. Owner-controlled 414×896 lane-direction visual acceptance remains the final PR3 gate.
