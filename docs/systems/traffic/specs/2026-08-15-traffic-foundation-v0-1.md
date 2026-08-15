# Traffic Foundation v0.1 — Design Specification

**Status:** Approved  
**System:** `traffic`  
**Date:** `2026-08-15`  
**Umbrella milestone:** Citizen Mobility & Traffic Foundation v0.1

## Decision Summary

Traffic v0.1 turns real Citizen Mobility trips into deterministic walking/driving transport over graphs derived from the existing Road and Building authorities. Every visible pedestrian must correspond to a real active Walk trip and every visible car must correspond to a real active Drive trip. The logical trip continues when its Three.js representation is not materialized; camera visibility, LOD, pooling, and render interpolation never become Traffic authority.

Traffic owns route planning and active transport progression, plus the deterministic queue state required to move trips through Road nodes/intersections. Road occupancy and connectivity remain Road authority. Building placement/frontage remains Building authority. Traffic derives pedestrian and vehicle graphs from narrow immutable projections supplied by `apps/game`.

The first production version supports Walk and Drive commute transport, deterministic route selection, versioned basic-road traffic profiles, real intersection queues, load/congestion/travel-time projections, topology-change recovery, Save/Load exact resume, pooled/LOD Three.js agents, Citizen/Vehicle Inspect, and a Traffic information view. Public transit, parking, signals, freight, accidents, and congestion-triggered mid-trip rerouting are deferred.

## Context

The existing Road system owns `basic-road` cell codes, cardinal connectivity, ramp validity, Road access, and Save. It explicitly does not own traffic/pathfinding/capacity. Buildings already derive Road frontage. Citizen Mobility v0.1 provides real Citizen trip intent, origin/destination Building IDs, and selected mode.

The product requirement is not merely a traffic number or decorative ambient animation. The city must visibly contain real Citizens walking and real cars commuting. At the same time, mobile scale makes it unacceptable to create/update a Three.js object for every Citizen on every frame. Traffic therefore separates logical transport truth from materialized visual agents.

## Goals

- Produce deterministic Walk/Drive routes between real Building access points.
- Keep Road and Building as upstream authorities; derive all transport graph topology.
- Represent every active transport trip logically even when off-screen.
- Make every visible pedestrian/car traceable to one real Citizen + Mobility trip.
- Add Road load, queues, congestion, and travel-time behavior driven by real trips.
- Avoid same-tick route↔congestion cycles by using the previous committed cost projection for new route planning.
- Support deterministic route recovery after Road topology mutation.
- Resume mid-trip exactly across Save/Load without persisting Three.js state.
- Materialize only relevant agents using spatial queries, deterministic prioritization, pooling, and LOD.
- Preserve mobile viability at large logical Citizen/trip counts.
- Expose narrow Traffic projections for Inspect, information views, and later Land Value/Economy/Services factors.

## Non-Goals

- Owning Citizen identity/activity purpose or RCI state.
- Owning Road cells, Road connectivity, Building placement, or Building frontage.
- Public transit, bikes, parking, car ownership, carpooling, freight, deliveries, emergency vehicles, tourism, or school trips.
- Traffic lights, player signal controls, stop-sign gameplay, lane customization, one-way Road gameplay, bridges/tunnels, or incidents.
- Congestion-triggered mid-trip rerouting in v0.1.
- Physical vehicle damage/collisions.
- Treating render-frame movement as authoritative simulation.
- Persisting meshes, transforms, animation frames, camera bubbles, graph caches, or route caches.

## System Boundary

### Planned packages

`packages/traffic-core`

- framework-independent transport graphs and routing,
- active Walk/Drive transport state,
- deterministic intersection queues,
- Traffic reconciliation and route-recovery rules,
- load/congestion/travel-time projections,
- serialization/validation contracts.

`packages/traffic-three`

- pedestrian/vehicle visual materialization,
- geometry-path sampling/interpolation,
- pooling,
- LOD/update cadence,
- spatial materialization policy,
- deterministic appearance variants,
- presentation-only animation state.

`traffic-core` must not import `rci-core`, `citizen-mobility-core`, `road-core`, `building-core`, DOM, or Three.js. `apps/game` translates authoritative world state into narrow transport source projections and composes Traffic atomically. `traffic-three` may depend on stable Traffic projection contracts but must not mutate Traffic state.

### Narrow source projections

Conceptually:

```text
RoadTrafficSourceProjection
- roadRevision
- world dimensions
- occupied basic-road cells
- definitionCode per cell
- cardinal connection mask
- ramp/grade traversal attributes required by Traffic

BuildingAccessProjection
- buildingRevision
- buildingInstanceId
- deterministic Road-frontage edge / access anchor

TransportRequest
- tripId
- citizenId
- originBuildingId
- destinationBuildingId
- purpose
- candidate mode
- departureGameMinute
```

Traffic does not infer Housing/Employment relationships; Mobility supplies trip endpoints.

## Authoritative and Derived State

### Traffic authority

The canonical Traffic snapshot owns the minimum state required to continue each committed transport trip deterministically:

```text
TrafficSnapshotV1
- revision
- policyVersion
- graphSourceRevisions
- activeTransportTrips[]
```

Conceptual active transport trip:

```text
TransportTripState
- tripId
- citizenId
- mode: Walk | Drive
- originBuildingId
- destinationBuildingId
- routeEdgeIds[]
- routeGraphRevision
- segmentIndex
- progressQ / segment timing state
- queueState?            // stable node/movement waiting state when applicable
- status: Active | Arrived | Failed | Cancelled
- failureReason?
```

The Mobility `tripId` is the cross-system trip identity. Traffic does not create a second Citizen or Mobility trip sequence.

### Derived Traffic state

The following are deterministic projections/caches from committed Traffic + graph/profile inputs unless a later version explicitly introduces historical smoothing authority:

- pedestrian/vehicle graph objects,
- edge occupancy/load/flow,
- queue lengths derived from active queue states,
- free-flow and effective travel times,
- congestion level,
- ETA projections,
- route candidate cache,
- spatial bins for active routes/agents,
- Three.js positions, rotations, animation, materialization, LOD, and appearance.

A committed Traffic-cost projection is rebuilt from the previous committed snapshot and used as an immutable planning input for newly departing trips.

## Transport Graph Authority

Road remains authoritative for Road occupancy and cardinal connectivity. Traffic graphs are derived consumers.

### Vehicle graph

Each traversable `basic-road` connection becomes deterministic directed vehicle edges according to a versioned `TrafficRoadProfile` keyed by Road `definitionCode`.

The foundation profile defines, at minimum:

- free-flow speed,
- flow/occupancy capacity semantics,
- node/intersection service capacity,
- traversal support for valid flat/ramp Road topology,
- visual lane/centerline offsets used by presentation projections.

The profile is Traffic content, not Road authority. Adding future Road definitions may expose stable codes consumed by the Traffic profile registry without moving Traffic state into `road-core`.

### Pedestrian graph

The pedestrian graph is a deterministic derived sidewalk/access graph from the same Road topology plus Building frontage:

```text
Building entrance anchor
→ frontage connector
→ road-side pedestrian corridor
→ intersection pedestrian connector
→ destination frontage connector
→ Building entrance anchor
```

The v0.1 Road may not expose gameplay sidewalk objects; Traffic owns the derived logical pedestrian corridor projection only. A Building entrance anchor is derived from the deterministic center of the accepted frontage edge/access side. No arbitrary nearest-Road search may override valid existing frontage authority.

Pedestrian path geometry must remain visually separated from the vehicle centerline by deterministic profile offsets so people do not intentionally walk through the middle of Road lanes.

## Routing

Traffic provides deterministic candidate plans for Walk and Drive.

### Cost semantics

Walk:

```text
route cost = integer walking travel time
```

Drive:

```text
route cost = integer access time
           + integer Road traversal time
           + previous committed congestion/travel-time cost
```

All authoritative comparisons use integer/fixed-point units. Floating-point geometry may be used only after route authority is fixed for presentation.

### Algorithm and tie-breaking

Use deterministic A* or an equivalent deterministic shortest-path algorithm.

Tie order is explicit and stable:

1. total candidate cost,
2. path length / traversal count where the algorithm needs a secondary key,
3. canonical node ID,
4. canonical edge ID.

Iteration order of JavaScript `Map`/`Set` must never be the implicit tie-break contract.

### Route cache

Derived route candidates may be cached by stable inputs such as:

```text
mode
originAccessNode
destinationAccessNode
roadGraphRevision
trafficCostRevision
routingPolicyVersion
```

Cache entries are disposable and never persisted as authority.

## Route Lifecycle

### Departure

1. Read one coherent Road/Building source projection and previous committed Traffic cost projection.
2. Build or read the derived graph for the current source revisions.
3. Plan candidate Walk/Drive routes requested by Mobility.
4. Return availability + integer cost for mode selection.
5. After Mobility selects a mode, commit the selected route and TransportTripState in the same staged world transaction as the Mobility trip.

### Normal progression

Active trips progress through route edges using deterministic game-time/fixed-point state. Render frame delta cannot advance authority.

### No normal mid-trip rerouting

Congestion changes do not reroute an already departed trip in v0.1. This prevents route thrashing and keeps replay stable.

### Topology invalidation recovery

Road mutation may invalidate an active route. After a committed Road revision changes:

1. validate remaining route edges against the new graph,
2. valid route → continue unchanged,
3. invalid route → identify the current stable logical node/access point,
4. deterministically replan from that node to the latest valid authoritative destination,
5. replacement route available → continue and record recovery,
6. no route/destination available → fail `UnreachableDestination` without deleting the Citizen/Employment/Household.

Recovery from a Road mutation is not the same as live congestion rerouting and is allowed in v0.1.

## Traffic Flow, Capacity, and Congestion

The foundation uses logical per-trip progression plus versioned Road/node service policies. It does not require a rigid-body or per-frame microscopic physics simulation.

Each directed Road edge/node exposes deterministic service/capacity semantics from the Traffic Road profile. Active Drive trips contribute to occupancy/load. Entry or intersection demand beyond available service capacity creates deterministic logical waiting/queue state.

### Queue order

At a shared node/intersection, ordering must be stable. Foundation ordering is:

1. logical arrival `GameMinute` / fixed-point arrival time,
2. movement priority from versioned unsignalized-intersection policy,
3. `tripId` as final stable tie-break.

No runtime randomness is allowed.

### Intersection semantics

v0.1 treats an intersection movement as an incoming directed edge → outgoing directed edge transition. The foundation uses a deterministic unsignalized node-service policy and does not expose traffic-light gameplay. Queue/service rules must prevent authoritative trips from passing an over-capacity node as though no queue existed.

Presentation may derive smooth turn curves, but those curves do not own service order.

### Congestion projection

Traffic derives at least:

- active trip load per Road edge,
- load/capacity ratio,
- queue length/wait,
- free-flow travel time,
- effective travel time,
- normalized congestion level suitable for Information View display.

The exact integer flow formula/constants are versioned in `TrafficFlowPolicyV1` and must be frozen with RED/GREEN tests before production implementation closes. The semantic contract is fixed here: effective time must be monotonic with added load/queue under otherwise equal conditions, and capacity overflow must produce measurable delay rather than visual-only density.

## Lagged Congestion / Routing Contract

New trip planning at committed world state `T` uses the cost projection derived from the previously committed Traffic state available at `T`.

```text
committed Traffic state
→ derive immutable cost field
→ plan newly due trips
→ commit new routes + progressed Traffic state
→ derive next committed cost field
```

There is no route → congestion → reroute feedback loop inside the same authoritative reconciliation. This keeps dependency direction deterministic and mirrors the project's existing lagged feedback pattern.

## Real Visual Pedestrian Contract

A visible pedestrian must satisfy all of the following:

- maps to one present RCI `citizenId`,
- maps to one active Mobility `tripId`,
- that trip mode is `Walk`,
- its route/progress comes from committed Traffic state,
- its Three.js transform is derived from route geometry + committed/interpolated progress,
- deleting/repooling the visual object cannot cancel or advance the logical trip.

Pedestrian presentation states initially include `Idle` at queue/access points and `Walk` while progressing.

No decorative anonymous pedestrians are permitted as canonical v0.1 production traffic.

## Real Visual Vehicle Contract

A visible car maps to exactly one active `Drive` trip and therefore to one real `citizenId` + `tripId`.

v0.1 does not model persistent household car assets. Semantics are:

```text
one active Drive trip
→ one logical vehicle-trip representation
→ zero or one materialized visual car
```

The visual car derives route position, heading, stop/queue state, and turn interpolation from committed Traffic state. It does not own private-car identity, parking, fuel, or lifecycle outside the trip.

Initial presentation states include `Drive`, `Stop`, and `Turn`.

## Materialization, LOD, and Pooling

All logical trips continue independent of visibility.

### Presentation tiers

```text
Near camera
→ full pedestrian/vehicle agent + normal animation/update cadence

Mid distance
→ cheaper mesh/animation/update cadence

Far/invisible
→ no Three.js agent; logical Traffic only
```

Thresholds are versioned presentation policy, not Save authority.

### Deterministic materialization under caps

When more eligible logical trips are near the camera than the presentation budget allows, select materialized agents deterministically by stable spatial bucket/distance class and `tripId` tie-break. Camera movement may change which agents are materialized but must not change Traffic state, routes, queues, arrival times, or trip count.

### Pools

Use reusable pedestrian and vehicle visual pools. Repeated camera entry/exit must not allocate/dispose a new mesh hierarchy per trip on every transition.

### Spatial index

Materialization queries use Traffic route/agent spatial bins or equivalent chunk indexes. Per-frame code must not scan all Citizens or all active world trips.

## Visual Spacing and Geometry

Authoritative queue/order is logical. Three.js derives readable spacing from edge ordering, queue state, minimum visual headway, and route geometry.

Visual headway may prevent mesh overlap but must not alter Traffic arrival/queue authority. If visual spacing cannot exactly represent extreme logical density, presentation degrades by LOD/materialization rather than mutating authoritative traffic counts.

## Deterministic Appearance

Pedestrian appearance variants may derive from stable `citizenId` + versioned appearance seed/policy. Vehicle visual variant/color may derive from stable trip/Citizen seed until a future Vehicle Ownership authority exists.

Raw meshes, colors, clothing choices, animation frames, and materialized objects are derived and not persisted.

## Inspect and Information View

Use the frozen City UI contextual Inspect architecture rather than redesigning the shell.

### Citizen/Pedestrian Inspect projection

Expose existing Citizen identity/projection fields only when actually available, plus Mobility/Traffic presentation facts such as:

- stable Citizen ID,
- Household/Home/Employment references from existing projections,
- current activity,
- trip purpose,
- mode,
- destination,
- estimated/elapsed travel state.

Do not invent a Citizen name if RCI does not own one.

### Vehicle Inspect projection

Expose:

- linked Citizen ID,
- trip purpose,
- origin/destination,
- current route/Road segment identifier,
- queue/congestion/travel-time projection.

### Traffic Information View

Provide a derived Road overlay based on committed congestion/load state. Visual thresholds are accessible and must not rely on color alone; the underlying Traffic metrics remain authoritative outside UI.

## Persistence and Migration

Introduce `TrafficSaveV1` inside planned `WorldSaveV7`.

Persist only transport authority required for exact resume:

- Traffic revision and policy versions,
- graph source revision references needed for validation,
- active route edge IDs,
- route graph revision,
- segment index/progress/timing state,
- stable queue/wait state when it cannot be reconstructed without losing exact order,
- trip status/failure state required for cross-system resume.

Do not persist:

- graph caches,
- edge-load/congestion caches that rebuild from committed state,
- route cache,
- spatial index,
- Three.js objects/transforms/animation/LOD/materialization,
- visual appearance parameters that are deterministically derivable.

### Old-save migration

`WorldSaveV1–V6` contain no Traffic authority. Their deterministic `WorldSaveV7` migration starts with no active Transport trips. Citizen Mobility migration establishes stationary current activities; real transport appears from future schedule boundaries rather than synthetic historical catch-up trips.

Decode validates Traffic against decoded Mobility, Road, Building, and policy registries before world publication. Any invalid cross-reference fails the load atomically.

## Save / Load Equivalence

Saving during an active Walk/Drive trip and loading again must preserve:

- same Citizen,
- same Mobility trip ID,
- same mode,
- same selected route unless the loaded authoritative Road snapshot differs by an explicit migration rule,
- same logical segment/progress/queue order,
- equivalent next arrival/progression under the same future ticks.

The visual object may be a newly acquired pooled agent at a newly derived interpolated position; object identity itself is not preserved.

## Atomic World Integration

The planned committed-tick order is conceptually:

```text
read one committed world
→ advance Simulation
→ stage Building lifecycle/growth
→ stage RCI lifecycle/Housing/Employment/Demand
→ reconcile Citizen Mobility source changes
→ evaluate due Mobility boundaries
→ derive current Traffic graphs/cost projection
→ plan candidate routes and select modes
→ commit new Mobility + Traffic trips
→ progress active Traffic / queues / arrivals
→ validate cross-system references and invariants
→ publish one new committed world revision
→ update Traffic Three.js and City UI from committed projections
```

Detailed ordering relative to existing RCI/Economy settlement is fixed in the TDD implementation plan after source-level dependency audit. The invariant is fixed now: no consumer sees a partially published Mobility/Traffic state.

## Determinism

- Authoritative time/progress/cost/capacity decisions use integer or validated fixed-point values.
- Stable graph node/edge IDs derive from canonical world coordinates/topology, not object allocation order.
- Routing and queue ordering use explicit stable comparators.
- No `Math.random()`, `Date.now()`, frame delta, camera state, or Three.js transform influences authoritative outcomes.
- Failed/stale plans do not consume Mobility IDs or partially publish Traffic state.
- Replay from identical committed state + commands/ticks produces identical Mobility/Traffic fingerprints.

## Performance Contract

Production architecture targets:

```text
Logical Citizens scale gate       >= 20,000
Concurrent logical trips gate     >= 5,000
Materialized pedestrians target   <= 300
Materialized vehicles target      <= 300
Normal combined full-detail       400–500 agents
```

Materialization limits are presentation budgets, not Traffic caps.

Required mechanisms:

- no per-frame global Citizen/trip scan,
- spatial bins/chunk index for materialization,
- pooled visual agents,
- LOD/update cadence tiers,
- route cache keyed by graph/cost revisions,
- dirty-region graph rebuilding after localized Road changes,
- event/active-trip based authoritative reconciliation.

PR9/performance work must record measured CPU/frame/memory evidence on the project's defined reference environments before Foundation closure. Exact millisecond budgets are frozen from that reproducible benchmark rather than guessed in this design document.

## Failure Behavior

Typed failure classes must distinguish at least:

- invalid/missing Building access,
- no pedestrian route,
- no vehicle route,
- topology invalidated route,
- unreachable destination after recovery,
- stale source revision,
- invalid Save/cross-reference.

A Traffic failure never directly removes Employment, Household, Citizen, Road, or Building authority. Future Accessibility/RCI/Land Value policies may consume repeated failure projections, but v0.1 Traffic is not allowed to fire a Citizen or abandon a Building as a hidden side effect.

## Extension Points

Known future seams include:

- Shopping/Leisure/Education/Service trip purposes from Citizen Mobility,
- public transit and bicycle candidate modes,
- persistent Vehicle Ownership and parking,
- traffic signals / controlled intersections,
- one-way/multi-road Traffic profiles,
- freight/delivery/emergency vehicle trip classes,
- accessibility and congestion factors for RCI/Land Value/Economy,
- live incidents and dynamic rerouting,
- richer pedestrian destinations and public spaces.

These extend mode/profile/policy/projection registries without moving Road/Citizen/Building authority into Traffic.

## Acceptance Criteria

### Simulation truth

- Every active Traffic trip references one committed Mobility trip and one real Citizen.
- Every visible pedestrian is an active real Walk trip; every visible car is an active real Drive trip.
- No production acceptance relies on anonymous decorative fake traffic.
- Off-screen materialization changes do not alter routes/progress/queues/trip count.
- Road/Building source authority remains upstream and transport graphs are rebuildable.
- Route planning is deterministic under equal inputs and tie conditions.
- New routes use lagged committed congestion costs; no same-tick feedback loop exists.
- Road topology invalidation recovers/replans or fails deterministically.
- Added load/queues monotonically increase effective delay under the same profile inputs.
- Save/load mid-trip produces equivalent continuation.

### Visual product acceptance

A representative city with real Housing/Employment must visibly demonstrate:

```text
morning schedule window
→ Citizens leave Residential Buildings
→ Walk-mode Citizens appear on derived pedestrian corridors
→ Drive-mode Citizens appear as real cars on Roads
→ shared commute corridors gain visible/logical traffic
→ node queues/congestion increase when demand exceeds service
→ Citizens arrive at real Workplace Buildings

return-home window
→ reverse commute becomes visible from the same real Citizen trips
```

Inspecting a visible person/car must expose the linked Citizen/trip identity. Camera movement/LOD must not create or destroy logical commuters.

### Scale / integration acceptance

- At least 20,000 logical Citizens and 5,000 concurrent trips pass deterministic scale verification.
- Browser acceptance covers real Walk + Drive agents, congestion, Road mutation recovery, Save/Load, Inspect, Traffic overlay, camera materialization, and WebGL/context restoration.
- Existing Road/Zoning/Building/RCI/Economy/City UI authority and browser contracts remain green unless an explicitly approved new contract changes them.

## PR Decomposition

Traffic-side delivery slices for the umbrella milestone:

1. Traffic core contracts, stable graph IDs/profiles, validation, `TrafficSaveV1` skeleton.
2. Pedestrian + vehicle graph projections from Road/Building access.
3. Deterministic multimodal routing and cache seam.
4. Active Traffic progression, node queues, load/congestion/travel-time projection.
5. Road topology invalidation and deterministic route recovery.
6. `apps/game` committed-world + `WorldSaveV7` integration with Citizen Mobility.
7. Real pedestrian Three.js agents.
8. Real vehicle Three.js agents.
9. Materialization/spatial index/pooling/LOD/performance hardening.
10. Citizen/Vehicle Inspect + Traffic Information View.
11. Browser acceptance, scale/performance evidence, deterministic replay, production hardening.

The detailed cross-system PR order, RED tests, file ownership, and final verification gates are defined only after written-spec approval in the TDD implementation plan.

## Related Documents

- System overview: [`../README.md`](../README.md)
- ADR: [`../adrs/0001-logical-real-trips-materialized-visual-agents.md`](../adrs/0001-logical-real-trips-materialized-visual-agents.md)
- ADR: [`../adrs/0002-derived-transport-graphs-and-lagged-costs.md`](../adrs/0002-derived-transport-graphs-and-lagged-costs.md)
- Citizen Mobility specification: [`../../citizen-mobility/specs/2026-08-15-citizen-mobility-foundation-v0-1.md`](../../citizen-mobility/specs/2026-08-15-citizen-mobility-foundation-v0-1.md)
- Roads current state: [`../../roads/README.md`](../../roads/README.md)
- Buildings current state: [`../../buildings/README.md`](../../buildings/README.md)
- City UI frozen baseline: [`../../city-ui/README.md`](../../city-ui/README.md)
- TDD plan: pending written-spec approval
- Verification: pending implementation
