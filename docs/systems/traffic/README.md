# Traffic System

**Status:** Approved design — not implemented  
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Planning baseline:** `master@394e5ec484277b3b2e709b40d4c38191809c5f3e`  
**Planned ownership:** `packages/traffic-core`, `packages/traffic-three`; atomic composition by `apps/game`  
**Planned persistence:** `TrafficSaveV1` inside `WorldSaveV7`

## Purpose

Own deterministic pedestrian/vehicle transport planning and progression over derived network graphs, including route selection, active transport-trip state, intersection queues, congestion/travel-time projections, and the materialization seam for real visual pedestrians and cars.

The production goal is visual truth: a person visible on a sidewalk is a real Citizen on a real Walk trip; a visible car is a real Citizen's active Drive trip. Traffic must not use decorative random agents as canonical traffic. Off-screen trips remain logical and continue without Three.js objects.

## Does Not Own

- Citizen identity, Household, Housing, Employment, migration, or RCI Demand.
- Citizen activity/schedule/trip-purpose authority.
- Road occupancy or Building authority.
- Terrain/Water authority.
- Simulation clock authority.
- UI authority.
- Parking, car ownership, public transit, bicycles, traffic lights, accidents, freight, emergency vehicles, or dynamic congestion rerouting in v0.1.

## Approved Authority Boundary

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

Road and Building snapshots remain upstream authority. Traffic graphs are derived. Camera/Three.js state is presentation only.

## Foundation Behavior

- Walk and Drive routes from Building access to Building access.
- Pedestrian graph derives sidewalk/access corridors from Road topology and Building frontage.
- Vehicle graph derives directed traversal edges from Road connectivity and versioned Traffic Road profiles.
- Deterministic shortest-path routing with explicit stable tie-breaking.
- Route is locked after departure except deterministic recovery when Road topology invalidates it.
- New route planning reads the previous committed congestion/travel-cost projection; no same-tick route↔congestion cycle.
- Active logical trips continue off-screen.
- Near-camera real trips materialize as pooled Three.js pedestrian/car agents; far trips do not require objects.
- Agent caps limit presentation work, not logical Traffic counts.
- Citizen/Vehicle Inspect and Traffic information view consume committed Traffic projections.

## Planned Performance Contract

- Logical scale gate: at least 20,000 Citizens and 5,000 concurrent trips.
- Materialized target budgets: up to 300 pedestrians, up to 300 vehicles, with a normal full-detail combined target of 400–500 agents.
- No per-frame scan of all Citizens or all world trips.
- Spatial indexes, pooling, LOD, route caching, and dirty-region graph rebuilds are required production mechanisms rather than optional optimizations.

## Planning Documents

- [Traffic Foundation v0.1 specification](specs/2026-08-15-traffic-foundation-v0-1.md)
- [ADR-0001 — Logical real trips with materialized visual agents](adrs/0001-logical-real-trips-materialized-visual-agents.md)
- [ADR-0002 — Derived transport graphs and lagged congestion costs](adrs/0002-derived-transport-graphs-and-lagged-costs.md)
- Related: [Citizen Mobility](../citizen-mobility/README.md), [Roads](../roads/README.md), [Buildings](../buildings/README.md), [Simulation Time](../simulation-time/README.md), [City UI](../city-ui/README.md)

TDD and verification records will be added only after written-spec review and implementation planning.
