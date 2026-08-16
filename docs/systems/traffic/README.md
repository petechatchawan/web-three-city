# Traffic System

**Status:** Implemented — v0.1 release candidate; owner visual acceptance pending<br>
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Primary ownership:** `packages/traffic-core`, `packages/traffic-three`; atomic composition by `apps/game`<br>
**Persistence:** `TrafficSaveV1` inside `WorldSaveV7`

## Purpose

Own deterministic pedestrian/vehicle graph derivation, multimodal routing, logical trip progression, intersection queues, congestion/travel-time projections, route recovery, and Traffic persistence while keeping Road, Building, Citizen, Simulation and Three.js presentation authority separate.

The production goal is visual truth: a visible pedestrian is a real Citizen Walk trip and a visible car is a real Citizen Drive trip. Off-screen trips remain logical; renderer state never becomes canonical Traffic state.

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
     materialization + pooling + LOD
                    ↓
       real pedestrians / real cars
```

## Implemented Traffic Core

`packages/traffic-core` now provides:

- strict Road/Building source projection contracts;
- immutable `TrafficSnapshotV1` + deterministic snapshot/graph fingerprints;
- versioned `basic-road` speed/capacity/intersection/offset profile;
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
- no imports from RCI, Mobility, Road, Building, DOM, or Three.js.
- `apps/game` atomic integration with real Mobility trips, Road/Building projections, Simulation time, and deterministic Road-change recovery;
- `WorldSaveV7` persistence and V1–V6 migration, preserving logical route/progress/queue state without synthetic trips;
- `traffic-three` pooled pedestrian/vehicle materialization, spatial indexing, deterministic caps, and LOD where every materialized agent resolves to a real Citizen-linked trip;
- Citizen/Vehicle Inspect projections and the localized Traffic Information View consume committed state without mutating Traffic authority.

Flow policy v1 keeps zero-load time equal to free-flow and adds monotonic delay only when load exceeds edge capacity or queue wait exists. Ordinary congestion never reroutes an active trip; only topology/destination invalidation invokes recovery.

## Current Limitations and Extension Points

Public transit, parking, signals, freight, accidents, and ordinary congestion-triggered mid-trip rerouting remain deferred. Road topology/destination invalidation can recover or fail active trips deterministically; ordinary congestion does not reroute an active trip in v0.1.

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
- [PR11 release plan](../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-release-pr11.md)
- [World/Application integration plan](../world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md)
- [City UI integration plan](../city-ui/tdd/2026-08-15-citizen-traffic-inspect-information-view-v0-1.md)
- [ADR-0001 — Logical real trips with materialized visual agents](adrs/0001-logical-real-trips-materialized-visual-agents.md)
- [ADR-0002 — Derived transport graphs and lagged congestion costs](adrs/0002-derived-transport-graphs-and-lagged-costs.md)

Release verification covers deterministic 20,000-Citizen/5,000-trip fixtures, Save/Load continuation, Road recovery, presentation caps/LOD, and the targeted `@traffic|@building` browser ownership set. Owner-controlled manual visual acceptance remains the final gate for this release candidate.
