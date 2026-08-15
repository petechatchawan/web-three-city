# Traffic System

**Status:** Partial — core graph authority implemented; routing/flow/presentation pending  
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Planning baseline:** `master@6fb09e426147369dfaa274d55339994edf0e8e69`  
**Primary ownership:** `packages/traffic-core`, planned `packages/traffic-three`; atomic composition by `apps/game`  
**Planned persistence:** `TrafficSaveV1` inside `WorldSaveV7`

## Purpose

Own deterministic pedestrian/vehicle transport planning and progression over derived network graphs while keeping Road, Building, Citizen, Simulation and Three.js presentation authority separate.

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

## Implemented Graph Foundation

`packages/traffic-core` now provides a dependency-free graph foundation:

- strict Road/Building source projection contracts;
- immutable `TrafficSnapshotV1` and deterministic snapshot/graph fingerprints;
- versioned `basic-road` Traffic profile with speed/capacity/intersection/presentation offsets;
- deterministic directed vehicle graph from current Road connectivity;
- deterministic sidewalk graph using offset road-side nodes and intersection/cell connectors;
- deterministic Building access nodes derived only from supplied accepted frontage, with no nearest-Road fallback;
- canonical stable node/edge IDs independent of input array order;
- no imports from RCI, Mobility, Road, Building, DOM, or Three.js.

Source entry points:

- `packages/traffic-core/src/contracts.ts`
- `packages/traffic-core/src/road-profile.ts`
- `packages/traffic-core/src/vehicle-graph.ts`
- `packages/traffic-core/src/pedestrian-graph.ts`
- `packages/traffic-core/src/building-access.ts`
- `packages/traffic-core/src/traffic-snapshot.ts`

## Remaining Foundation Work

PR4 adds deterministic Walk/Drive routing and lagged costs. PR5 adds active progression, intersection queues, congestion, route recovery and `TrafficSaveV1`. PR6 integrates Road/Building/Mobility projections with the world transaction. PR7–PR9 provide real Three.js agents and production hardening; PR10–PR11 close UI/release acceptance.

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

Verification is intentionally deferred until the final test phase requested for this execution run.
