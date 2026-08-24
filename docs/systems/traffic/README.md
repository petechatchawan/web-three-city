# Traffic System

**Status:** Implemented — V2 temporal/physical core, Game transactions, and Road-reconciliation slices are complete; exact-head release/owner verification remains open<br>
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Primary ownership:** `packages/traffic-core`, `packages/traffic-three`; atomic composition by `apps/game`<br>
**Persistence:** `TrafficSaveV2` inside `WorldSaveV8`; V1/V7 migration remains supported

## Purpose

Own deterministic pedestrian/vehicle graph derivation, multimodal routing, logical trip progression, intersection queues, congestion/travel-time projections, route recovery, and Traffic persistence while keeping Road, Building, Citizen, Simulation and Three.js presentation authority separate.

The production goal is visual truth: a visible pedestrian is a real Citizen Walk trip and a visible car is a real Citizen Drive trip. Off-screen trips remain logical; renderer state never becomes canonical Traffic state.

For vehicle presentation, canonical Traffic progress, ordering, entry admission, and reservation state are simulation authority. The renderer derives a left-hand directional lane path from committed active trips, prepares deterministic line/cubic motion segments and arc-length lookup data outside RAF, and keeps a stable trip-to-pooled-vehicle mapping. It may smooth transforms behind canonical safe targets, but it cannot create capacity, own spacing, replay completed trips, or keep a renderer-owned arrival tail authoritative.

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
- immutable V1 compatibility and V2 `TrafficSnapshot` contracts with deterministic snapshot/graph fingerprints;
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
- V2-only authoritative Drive lifecycle phases: `WaitingForEntry`, `Entering`, `Travelling`, and `Leaving`, separate from terminal trip status; a transport quantum crosses at most one lifecycle boundary, and final-road completion enters `Leaving` before a later terminal arrival;
- subordinate `TrafficTimeCursor` (`4` transport quanta per GameMinute) with versioned pacing, rather than a second calendar;
- indexed canonical lane occupancy/headway caps and physical vehicle-envelope facts; the PR3.1 `650 mm` visual headway is not canonical Traffic capacity;
- all-or-nothing ingress/receiving/merge/conflict reservation bundles with owner-checked physical-clearance release and no timeout;
- derived Drive node classification (`SimpleContinuation`, `Diverge`, `Merge`, `ConflictJunction`) and deterministic compatible-bundle arbitration;
- load/capacity/congestion/effective-travel-time projections and next lagged cost field;
- topology/destination route recovery from a stable logical node;
- fail-closed `TrafficSaveV2` codec and explicit V1 -> V2 migration that persist cursor, route/progress, Drive phase, and reservation/traversal facts, never graph/cache/render state;
- no imports from RCI, Mobility, Road, Building, DOM, or Three.js;
- `apps/game` atomic integration with real Mobility trips, Road/Building projections, Simulation time, and deterministic Road-change recovery;
- Game Road source projection preserves canonical Road definition codes `1/2/3` and derives connectivity from non-empty Road occupancy across mixed Road types;
- `WorldSaveV8` composition and V7 migration, preserving V2 cursor/route/progress/phase/reservation state without synthetic trips.

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
- presentation-only interpolation/visual safety clamps behind canonical ordered traffic state; these are not a capacity or reservation authority;
  - active-trip route re-preparation when Road width/type or lane geometry changes, preserving canonical Mobility/Traffic trip identity, with deterministic reservation-safe Road mutation reconciliation;
- only active authoritative Traffic trips materialize; completed-trip receipts cannot recreate movement;
- pooled pedestrian/vehicle materialization, spatial indexing, deterministic caps, and LOD where every materialized agent resolves to a real Citizen-linked trip;
- Citizen/Vehicle Inspect projections and the localized Traffic Information View consuming committed state without mutating Traffic authority.

### Render submission remediation

The local PR #83 remediation keeps Traffic authority, logical active trips,
materialization caps, trip identity, and motion semantics unchanged while
batching presentation submissions. Vehicle body/roof and pedestrian body/head
are owned by bounded shared `InstancedMesh` batches; logical pooled handles
retain inspection and motion identity, while instance slots carry transforms
and deterministic appearance. Camera reconciliation permits one bounded
overlap of old and new policy-sized selections, and the presentation owner
disposes shared render resources exactly once. This changes render submission
cardinality, not Traffic state or visual-agent policy.

Flow policy v1 keeps zero-load time equal to free-flow and adds monotonic delay only when load exceeds edge capacity or queue wait exists. Ordinary congestion never reroutes an active trip; only topology/destination invalidation invokes recovery.

## vNext Integration Status and Handoff

The V2 temporal, lifecycle, reservation, arbitration, persistence, Game atomic-publication, and Road-mutation recovery slices have focused GREEN evidence. This is not release closure: exact-head CI/Sonar, targeted Chromium, and owner-controlled 414×896 visual acceptance remain external gates. The source specification is implemented locally; its release status is recorded in the PR evidence rather than inferred from package tests alone.

`traffic-core` owns transport cursor, Drive lifecycle, canonical headway, reservations, node classification, arbitration, recovery, and Traffic V2 persistence. `traffic-three` owns only derived geometry, materialization, pooling, and interpolation. `apps/game` owns minute-boundary and transport-quantum atomic publication plus `WorldSaveV8` composition. Journey Replay has been removed from the production movement path: only active authoritative Traffic trips may materialize.

The Game transport path reuses the derived directed Traffic graph while immutable Road, Building, and Building-environment authority is unchanged. A graph is rebuilt when one of those static authorities changes; the cache is an ephemeral derived index and is never persisted or used as a second Traffic authority.

## Motion Realism Authority Rules

PR3.1 is presentation-only. Its runtime state includes prepared curve geometry, visual route distance, visual speed, tangent heading, and bounded lag behind the latest committed Traffic target. These values are never saved and never feed canonical Traffic progression.

Normal visible Drive motion must satisfy:

```text
visualDistance <= canonicalTargetDistance
```

For vehicles sharing the same directed visual route span, the current presentation additionally enforces:

```text
followerVisualDistance <= leaderVisualDistance - visualHeadway
```

The headway constraint is re-derived every rendered frame from actual visual kinematics rather than only from canonical targets. It can cap forward visual motion but never pulls a car backward, changes canonical order, or becomes persisted simulation state.

Canonical `queued` forces the presentation desired speed toward zero without allowing momentum to cross the committed target. Releasing the queue resumes the same acceleration policy. Road Local/Collector/Arterial canonical Traffic speed/capacity values remain unchanged by PR3.1.

Visual headway is also presentation-only. It may delay or de-materialize a rendered car to prevent overlap, but it may not reorder, delay, or mutate the canonical Traffic trip. Likewise, canonical trip completion ends logical Traffic authority immediately while an already materialized vehicle may finish its remaining visual route; that bounded presentation tail is never persisted and cannot re-enter simulation state.

## Current Limitations and Extension Points

The current lane-aware model is deliberately bounded to one directional travel lane each way on the existing single-cell two-way Road footprint. There is no lane changing/overtaking, one-way Road behavior, U-turn generation, multi-cell four/six-lane avenue footprint, signals, roundabouts, parking, vehicle ownership, transit, freight, accidents, or ordinary congestion-triggered mid-trip rerouting. Road topology/destination invalidation can still recover or fail active trips deterministically; ordinary congestion does not reroute an active trip in v0.1.

PR3.1 smooths the visible follower but does not introduce microscopic car-following physics or make visual acceleration canonical. Traffic signals/stop controls and street-light props remain separate future systems. Vehicle Life authority, persistent car ownership/parking, and concrete vehicle assignment remain PR4–PR6 work.

The transport-quantum graph/topology cache is now part of the bounded performance path: repeated quanta reuse the immutable graph, while Road/Building/environment changes deterministically invalidate it. This does not alter canonical trip progression or reservation ordering.

## Performance Contract

- Logical scale gate: at least 20,000 Citizens and 5,000 concurrent trips.
- Materialized target budgets: up to 300 pedestrians, up to 300 vehicles, normal full-detail combined target 400–500 agents.
- No per-frame scan of all Citizens or world trips.
- Prepared curve controls and arc-length tables are built outside RAF; RAF performs elapsed-time kinematics, prepared-path sampling, visual headway constraint derivation over the bounded materialized vehicle set, and transforms only.
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

PR3.1 release verification covers cubic turn continuity, curve-aware route sampling, presentation acceleration/deceleration/turn-speed behavior, route-aware anti-overlap headway including per-frame real-kinematics regression, visual completion before arrival de-materialization, 30/60/120 FPS tolerance, simple curved Road markings, canonical-trip-preserving Road upgrades, targeted `@road|@traffic` browser ownership, clean worktree, Sonar, and owner-controlled 414×896 visual acceptance. Exact run/artifact IDs are recorded on PR #83 rather than this living document.
