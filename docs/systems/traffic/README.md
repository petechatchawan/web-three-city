# Traffic System

**Status:** Traffic Foundation v0.1 + PR3 Lane-aware Traffic + PR3.1 Motion & Junction Realism implemented; PR3.1 release/owner visual gate pending<br>
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Primary ownership:** `packages/traffic-core`, `packages/traffic-three`; atomic composition by `apps/game`<br>
**Persistence:** `TrafficSaveV1` inside `WorldSaveV7`

## Purpose

Own deterministic pedestrian/vehicle graph derivation, multimodal routing, logical trip progression, intersection queues, congestion/travel-time projections, route recovery, and Traffic persistence while keeping Road, Building, Citizen, Simulation and Three.js presentation authority separate.

The production goal is visual truth: a visible pedestrian is a real Citizen Walk trip and a visible car is a real Citizen Drive trip. Off-screen trips remain logical; renderer state never becomes canonical Traffic state.

For vehicle presentation, canonical Traffic progress and edge-route identity remain simulation authority. The renderer derives a left-hand directional lane path from the committed route, prepares deterministic line/cubic motion segments and arc-length lookup data outside RAF, and keeps a stable trip-to-pooled-vehicle mapping. Drive transforms follow a presentation-only acceleration/deceleration and turn-speed follower that is bounded behind canonical progress; heading comes from the prepared path tangent. Deterministic longitudinal visual headway remains lane-owned and no lateral spread is invented. None of this presentation state mutates canonical trip progress, queue order, Road state, or save state.

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
   directed lane path + cubic connectors
     prepared route + visual kinematics
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
- `WorldSaveV7` persistence and V1–V6 migration, preserving logical route/progress/queue state without synthetic trips.

## Implemented Traffic Presentation

`packages/traffic-three` and Game composition now provide:

- production left-hand `DirectedLanePath` derivation with one directional travel lane each way on the current single-cell two-way Road footprint;
- deterministic straight/left/right junction connectors with immediate U-turn generation rejected;
- turn connectors represented as two source-edge-attributed cubic Bézier halves rather than flattened angular slices;
- deterministic prepared line/cubic route geometry with precomputed arc-length lookup and curve-aware distance sampling;
- continuous vehicle heading from local line/cubic tangent rather than independent angular stepping;
- presentation-only vehicle kinematics with progressive acceleration/deceleration, canonical queue braking, bounded catch-up, and turn-speed reduction before/through turns;
- frame-rate-tolerant elapsed-time motion covered at 30/60/120 FPS schedules;
- Game presentation mapping of canonical edge progress onto the derived lane path so opposing Drive directions occupy opposite physical sides of the Road while canonical route/trip identity remains unchanged;
- active-trip route re-preparation when Road width/type or lane geometry changes, preserving canonical Mobility/Traffic trip identity;
- short-trip journey replay using the same prepared curve-aware position/tangent sampler so replay turns do not regress to angular geometry;
- pooled pedestrian/vehicle materialization, spatial indexing, deterministic caps, and LOD where every materialized agent resolves to a real Citizen-linked trip;
- Citizen/Vehicle Inspect projections and the localized Traffic Information View consuming committed state without mutating Traffic authority.

Flow policy v1 keeps zero-load time equal to free-flow and adds monotonic delay only when load exceeds edge capacity or queue wait exists. Ordinary congestion never reroutes an active trip; only topology/destination invalidation invokes recovery.

## Motion Realism Authority Rules

PR3.1 is presentation-only. Its runtime state includes prepared curve geometry, visual route distance, visual speed, tangent heading, and bounded lag behind the latest committed Traffic target. These values are never saved and never feed canonical Traffic progression.

Normal visible Drive motion must satisfy:

```text
visualDistance <= canonicalTargetDistance
```

Canonical `queued` forces the presentation desired speed toward zero without allowing momentum to cross the committed target. Releasing the queue resumes the same acceleration policy. Road Local/Collector/Arterial canonical Traffic speed/capacity values remain unchanged by PR3.1.

## Current Limitations and Extension Points

The current lane-aware model is deliberately bounded to one directional travel lane each way on the existing single-cell two-way Road footprint. There is no lane changing/overtaking, one-way Road behavior, U-turn generation, multi-cell four/six-lane avenue footprint, signals, roundabouts, parking, vehicle ownership, transit, freight, accidents, or ordinary congestion-triggered mid-trip rerouting. Road topology/destination invalidation can still recover or fail active trips deterministically; ordinary congestion does not reroute an active trip in v0.1.

PR3.1 smooths the visible follower but does not introduce microscopic car-following physics or make visual acceleration canonical. Traffic signals/stop controls and street-light props remain separate future systems. Vehicle Life authority, persistent car ownership/parking, and concrete vehicle assignment remain PR4–PR6 work.

The previously identified x4 world-tick/topology caching performance remediation is intentionally deferred from the Traffic/Vehicle Life functional slices and should remain a separate performance change unless release evidence requires earlier intervention.

## Performance Contract

- Logical scale gate: at least 20,000 Citizens and 5,000 concurrent trips.
- Materialized target budgets: up to 300 pedestrians, up to 300 vehicles, normal full-detail combined target 400–500 agents.
- No per-frame scan of all Citizens or world trips.
- Prepared curve controls and arc-length tables are built outside RAF; RAF performs elapsed-time kinematics, prepared-path sampling, and transforms only.
- Spatial indexes, pooling, LOD, route caching, and future dirty-region graph rebuilds remain the intended production mechanisms.

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
- [Motion & Junction Realism v1](../roads/specs/2026-08-19-motion-junction-realism-v1.md)
- [Motion & Junction Realism v1 TDD plan](../roads/tdd/2026-08-19-motion-junction-realism-v1.md)

PR3.1 release verification covers cubic turn continuity, curve-aware route sampling, presentation acceleration/deceleration/turn-speed behavior, 30/60/120 FPS tolerance, simple curved Road markings, canonical-trip-preserving Road upgrades, targeted `@road|@traffic` browser ownership, clean worktree, Sonar, and owner-controlled 414×896 visual acceptance. Exact run/artifact IDs are recorded on PR #83 rather than this living document.
