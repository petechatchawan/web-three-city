# Traffic Foundation v0.1 — Design Specification

**Status:** Approved  
**System:** `traffic`  
**Date:** `2026-08-15`  
**Umbrella milestone:** Citizen Mobility & Traffic Foundation v0.1

## Decision Summary

Traffic v0.1 turns real Citizen Mobility trips into deterministic walking/driving transport over graphs derived from the existing Road and Building authorities. Every visible pedestrian must correspond to a real active Walk trip and every visible car must correspond to a real active Drive trip. The logical trip continues when its Three.js representation is not materialized; camera visibility, LOD, pooling, and render interpolation never become Traffic authority.

Traffic owns route planning and active transport progression, plus deterministic waiting/queue state required to move trips through Road nodes/intersections. Road occupancy/connectivity remain Road authority. Building placement/frontage remains Building authority. Traffic derives pedestrian and vehicle graphs from narrow immutable projections supplied by `apps/game`.

The first production version supports Walk and Drive commute transport, deterministic routing, versioned `basic-road` traffic profiles, intersection queues, load/congestion/travel-time projections, topology-change recovery, Save/Load of committed logical progress, pooled/LOD Three.js agents, Citizen/Vehicle Inspect, and a Traffic information view. Public transit, parking, signals, freight, accidents, and normal congestion-triggered mid-trip rerouting are deferred.

## Context

The current Road system owns `basic-road` cell codes, cardinal connectivity, ramp validity, Road access, and Save. It explicitly does not own Traffic/pathfinding/capacity. Buildings already derive deterministic Road frontage. Citizen Mobility v0.1 provides real Citizen trip intent, origin/destination Building IDs, and selected mode.

The product requirement is not merely a Traffic number or decorative ambient animation. The city must visibly contain real Citizens walking and real cars commuting. At the same time, mobile scale makes it unacceptable to create/update a Three.js object for every Citizen on every frame. Traffic therefore separates logical transport truth from materialized visual agents.

## Goals

- Produce deterministic Walk/Drive routes between real Building access points.
- Keep Road and Building as upstream authorities; derive all transport graph topology.
- Represent every active transport trip logically even when off-screen.
- Make every visible pedestrian/car traceable to one real Citizen + Mobility trip.
- Add Road load, queues, congestion, and travel-time behavior driven by real trips.
- Avoid same-tick route↔congestion cycles by using a prior committed Traffic-cost projection for new route planning.
- Support deterministic route recovery after Road topology mutation or authoritative destination change.
- Resume the same committed logical mid-trip checkpoint across Save/Load without persisting Three.js state.
- Materialize only relevant agents using spatial queries, deterministic prioritization, pooling, and LOD.
- Preserve mobile viability at large logical Citizen/trip counts.
- Expose narrow Traffic projections for Inspect, information views, and later Land Value/Economy/Services factors.

## Non-Goals

- Owning Citizen identity/activity purpose or RCI state.
- Owning Road cells, Road connectivity, Building placement, or Building frontage.
- Public transit, bikes, parking, car ownership, carpooling, freight, deliveries, emergency vehicles, tourism, or school trips.
- Traffic lights, player signal controls, stop-sign gameplay, lane customization, one-way Road gameplay, bridges/tunnels, or incidents.
- Congestion-triggered normal mid-trip rerouting in v0.1.
- Physical vehicle damage/collision physics.
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

`traffic-core` must not import `rci-core`, `citizen-mobility-core`, `road-core`, `building-core`, DOM, or Three.js. `apps/game` translates authoritative world state into narrow transport source projections and coordinates Traffic with Citizen Mobility. `traffic-three` may depend on stable Traffic projection contracts but must not mutate Traffic state.

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

Traffic does not infer Housing/Employment relationships; Citizen Mobility supplies trip endpoints through orchestration.

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
- lastStableNodeId
- segmentIndex
- segmentEntryGameSecond
- progressQ / segment timing state
- queueState?
- status: Active | Arrived | Failed | Cancelled
- failureReason?
```

The Mobility `tripId` is the cross-system trip identity. Traffic does not create a second Citizen or Mobility trip sequence.

`lastStableNodeId` is required for deterministic recovery if a currently traversed or remaining Road edge is removed. Traffic never needs to invent a recovery anchor inside deleted topology.

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

A Traffic-cost projection is rebuilt from the prior committed Traffic snapshot and remains immutable while newly due trips are planned.

## Transport Graph Authority

Road remains authoritative for Road occupancy and cardinal connectivity. Traffic graphs are derived consumers.

### Vehicle graph

Each traversable `basic-road` connection becomes deterministic directed vehicle edges according to a versioned `TrafficRoadProfile` keyed by Road `definitionCode`.

The foundation profile defines at minimum:

- free-flow speed,
- flow/occupancy capacity semantics,
- node/intersection service capacity,
- traversal support for valid flat/ramp Road topology,
- vehicle visual centerline/lateral offsets used by presentation projections.

The profile is Traffic content, not Road authority. Future Road definitions may expose additional stable definition codes consumed by Traffic profiles without moving Traffic state into `road-core`.

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

The v0.1 Road does not need gameplay sidewalk objects. Traffic owns only the derived logical pedestrian corridor projection. A Building entrance anchor is derived from the deterministic center of the accepted frontage edge/access side. No arbitrary nearest-Road search may override valid existing frontage authority.

Pedestrian path geometry remains visually separated from the vehicle centerline by deterministic profile offsets so Citizens do not intentionally walk through the middle of Road lanes.

## Routing

Traffic provides deterministic candidate plans for Walk and Drive.

### Cost semantics

All authoritative transport costs are integer game-time values. The foundation unit is integer `GameSecond` for route traversal/cost, while Citizen activity/schedule boundaries remain integer `GameMinute`.

```text
absoluteGameSecond = absoluteGameTick * 3600 + secondOffsetWithinHour
```

A Mobility departure at `GameMinute M` converts to the corresponding integer game-second boundary. Integer game-second precision is fine enough for short 8m Road traversals without making floating-point geometry or frame delta authoritative.

Walk:

```text
route cost = integer walking travel seconds
```

Drive:

```text
route cost = integer access seconds
           + integer Road traversal seconds
           + prior committed congestion/wait seconds
```

Floating-point geometry may be used only after route/travel authority is fixed for presentation.

### Algorithm and tie-breaking

Use deterministic A* or an equivalent deterministic shortest-path algorithm.

Tie order is explicit and stable:

1. total candidate cost,
2. path length / traversal count where a secondary key is needed,
3. canonical node ID,
4. canonical edge ID.

JavaScript `Map`/`Set` iteration order is never the implicit route tie-break contract.

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

1. Read one coherent current Road/Building source projection.
2. Rebuild/read the graph for those current source revisions.
3. Project the prior committed Traffic costs onto graph edges that still exist; newly introduced edges use versioned free-flow/default cost because they have no prior congestion history.
4. Plan candidate Walk/Drive routes requested by Citizen Mobility.
5. Return availability + integer game-second cost for mode selection.
6. After Mobility selects a mode, commit the selected route and `TransportTripState` in the same staged publication as the Mobility trip.

### Normal progression

Active trips progress through route edges using deterministic integer game-second/fixed-point transport state evaluated inside Simulation advancement. Render frame delta cannot advance Traffic authority.

### No normal mid-trip rerouting

Congestion changes do not reroute an already departed trip in v0.1. This prevents route thrashing and keeps replay stable.

### Authoritative destination change

If Citizen Mobility reports that the authoritative Home/Work destination changed while a trip is active, Traffic treats the previous destination as stale even if the old Building still exists. It deterministically replans from the current recovery anchor to the newest valid destination or follows the typed failure/cancellation result supplied by orchestration.

### Topology invalidation recovery

Road mutation may invalidate an active route. After a committed Road revision changes:

1. validate the currently traversed and remaining route against the new graph,
2. route still valid → continue unchanged,
3. invalid route → use the most recent committed `lastStableNodeId` that still exists in the new graph as the recovery anchor,
4. if the current edge was deleted, never create a synthetic midpoint on the deleted edge,
5. deterministically replan from the recovery anchor to the newest valid authoritative destination,
6. replacement route available → continue and record recovery,
7. no valid anchor/route/destination → fail `UnreachableDestination` without deleting Citizen/Employment/Household authority.

Recovery from an authoritative Road/destination mutation is not live congestion rerouting and is allowed in v0.1.

## Traffic Flow, Capacity, and Congestion

The foundation uses logical per-trip progression plus versioned Road/node service policies. It does not require rigid-body or per-frame microscopic physics simulation.

Each directed Road edge/node exposes deterministic service/capacity semantics from `TrafficRoadProfile` / `TrafficFlowPolicyV1`. Active Drive trips contribute to logical occupancy/load. Entry or intersection demand beyond available service capacity creates deterministic logical waiting/queue state. Capacity overflow must create real delay; it cannot be a visual-density-only effect.

### Queue order

At a shared node/intersection, ordering is stable:

1. integer/fixed-point logical arrival time,
2. movement priority from versioned unsignalized-intersection policy,
3. `tripId` as final stable tie-break.

No runtime randomness is allowed.

### Intersection semantics

v0.1 treats an intersection movement as an incoming directed edge → outgoing directed edge transition. The foundation uses a deterministic unsignalized node-service policy and does not expose traffic-light gameplay. Queue/service rules prevent authoritative trips from passing an over-capacity node as though no queue existed.

Presentation may derive smooth turn curves, but those curves do not own movement/service order.

### Congestion projection

Traffic derives at least:

- active trip load per Road edge,
- load/capacity ratio,
- queue length/wait,
- free-flow travel time,
- effective travel time,
- normalized congestion level suitable for an Information View.

`TrafficFlowPolicyV1` owns the exact integer constants and service profile used by implementation. Those values are production data and must be versioned/fingerprintable. The semantic invariants are fixed here:

- effective travel time never becomes lower merely because additional equal-class load/queue was added,
- capacity overflow produces measurable logical waiting/delay,
- identical Traffic/Profile input produces identical load/queue/travel-time output,
- changing presentation density/LOD never changes congestion.

## Lagged Congestion / Routing Contract

New trip planning at world transition `T → T+1` uses the immutable Traffic-cost projection derived from committed Traffic state at `T`, mapped onto the current derived graph as described above.

```text
committed Traffic T
→ derive immutable cost field T
→ read current Road/Building graph source
→ map surviving edge costs; new edges get free-flow/default cost
→ plan newly due trips
→ progress/commit Traffic T+1
→ derive cost field T+1 for the next planning transition
```

There is no route → congestion → reroute loop inside the same authoritative reconciliation. This keeps dependency direction deterministic and matches the project's existing lagged-feedback approach.

## Render Interpolation versus Traffic Authority

The project keeps the existing one-game-hour Simulation tick authority. Within each committed tick transition Traffic processes departure, traversal, queue, and arrival events in deterministic game-second order.

Three.js may interpolate a materialized agent smoothly between committed logical route checkpoints using the known route geometry, segment timing, current Simulation speed, and presentation clock. That interpolation is presentation only:

- it does not consume IDs,
- it does not change queue order,
- it does not advance Traffic fingerprints,
- it freezes when the Simulation is paused,
- it may be recreated after reload/context loss from the last committed logical checkpoint.

`Step` advances one normal Simulation hour and therefore executes the same Traffic event interval deterministically, even if presentation renders the result immediately rather than animating a real-time hour.

## Real Visual Pedestrian Contract

A visible pedestrian must:

- map to one present RCI `citizenId`,
- map to one active Mobility `tripId`,
- have trip mode `Walk`,
- use route/progress from committed Traffic state,
- derive its Three.js transform from route geometry + presentation interpolation of committed logical progress,
- remain simulation-equivalent if its visual object is pooled/recreated.

Pedestrian presentation states initially include `Idle` at access/queue points and `Walk` while moving.

No decorative anonymous pedestrians are permitted to satisfy canonical v0.1 production Traffic acceptance.

## Real Visual Vehicle Contract

A visible car maps to exactly one active `Drive` trip and therefore one real `citizenId` + `tripId`.

v0.1 does not model persistent household car assets:

```text
one active Drive trip
→ one logical vehicle-trip representation
→ zero or one materialized visual car
```

The visual car derives route position, heading, stop/queue state, and turn interpolation from Traffic projections. It does not own private-car identity, parking, fuel, or lifecycle outside the trip.

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

When more eligible logical trips are near the camera than the presentation budget allows, select materialized agents deterministically by stable spatial bucket/distance class and `tripId` tie-break. Camera movement may change which agents are materialized but must not change Traffic routes, queues, logical arrival times, or trip count.

### Pools

Use reusable pedestrian and vehicle visual pools. Repeated camera entry/exit must not allocate/dispose a new mesh hierarchy per trip on every transition.

### Spatial index

Materialization queries use Traffic route/agent spatial bins or equivalent chunk indexes. Per-frame code must not scan all Citizens or all active world trips.

## Visual Spacing and Geometry

Authoritative queue/order is logical. Three.js derives readable spacing from edge ordering, queue state, minimum visual headway, and route geometry.

Visual headway may prevent mesh overlap but must not alter Traffic arrival/queue authority. If visual spacing cannot exactly represent extreme logical density, presentation degrades by LOD/materialization rather than mutating authoritative Traffic counts.

## Deterministic Appearance

Pedestrian appearance variants may derive from stable `citizenId` + versioned appearance seed/policy. Vehicle visual variant/color may derive from a stable trip/Citizen seed until a future Vehicle Ownership authority exists.

Raw meshes, colors, clothing choices, animation frames, and materialized objects are derived and are not persisted.

## Inspect and Information View

Use the frozen City UI contextual Inspect architecture rather than redesigning the shell.

### Citizen/Pedestrian Inspect projection

Expose existing Citizen identity/projection fields only when actually available, plus Mobility/Traffic facts such as:

- stable Citizen ID,
- Household/Home/Employment references from existing projections,
- current activity,
- trip purpose,
- mode,
- destination,
- estimated/elapsed logical travel state.

Do not invent a Citizen name if RCI does not own one.

### Vehicle Inspect projection

Expose:

- linked Citizen ID,
- trip purpose,
- origin/destination,
- current route/Road segment identifier,
- queue/congestion/travel-time projection.

### Traffic Information View

Provide a derived Road overlay based on committed congestion/load state. Thresholds must be accessible and must not rely on color alone; the underlying metrics remain Traffic projections outside UI authority.

## Persistence and Migration

Introduce `TrafficSaveV1` inside planned `WorldSaveV7`.

Persist only transport authority required for exact committed-state resume:

- Traffic revision and policy versions,
- graph source revision references needed for validation,
- active route edge IDs,
- route graph revision,
- `lastStableNodeId`,
- segment index / committed progress / timing state,
- stable queue/wait state when needed to preserve exact order,
- trip status/failure state required for cross-system resume.

Do not persist:

- graph caches,
- edge-load/congestion caches that rebuild from committed state,
- route cache,
- spatial index,
- Three.js objects/transforms/animation/LOD/materialization,
- the current sub-frame presentation interpolation fraction,
- visual appearance parameters that are deterministically derivable.

### Old-save migration

`WorldSaveV1–V6` contain no Traffic authority. Their deterministic `WorldSaveV7` migration starts with no active Transport trips. Citizen Mobility migration establishes stationary current activities; real Traffic begins from future schedule boundaries rather than synthetic historical catch-up trips.

Decode validates Traffic against decoded Mobility, Road, Building, and policy registries before world publication. Any invalid cross-reference fails the load atomically.

## Save / Load Equivalence

Saving and loading a committed world while a Walk/Drive trip is logically active must preserve:

- the same Citizen,
- the same Mobility `tripId`,
- the same mode,
- the same selected route against the same decoded Road/Building authority,
- the same committed segment/progress/queue checkpoint,
- equivalent future progression and arrival under the same future authoritative ticks.

Three.js object identity and the instantaneous sub-frame interpolation phase are explicitly not Save authority. After reload/context loss, presentation rematerializes from the saved committed logical checkpoint and resumes visual interpolation from that state. This avoids pretending renderer frame state is simulation truth.

## Atomic World Integration

The planned committed-tick order is conceptually:

```text
read one committed world
→ advance Simulation
→ stage Building lifecycle/growth
→ stage RCI lifecycle/Housing/Employment/Demand
→ reconcile Citizen Mobility source changes
→ evaluate due Mobility boundaries
→ derive current Road/Building transport graph
→ map prior committed Traffic costs onto that graph
→ plan candidate routes and select modes through apps/game
→ commit new Mobility + Traffic trips
→ progress active Traffic/queues/arrivals in game-time order
→ validate cross-system references and invariants
→ publish one new committed world revision
→ update traffic-three and City UI from committed projections
```

Detailed ordering relative to existing RCI/Economy daily settlement is fixed in the TDD implementation plan after source-level dependency audit. The invariant is fixed now: no consumer sees a partially published Mobility/Traffic state and Traffic cannot create a same-tick dependency cycle back into upstream RCI/Economy authority.

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

The performance-hardening PR must record CPU/frame/memory evidence on defined reference environments before Foundation closure. Exact millisecond budgets are frozen from reproducible measurements rather than guessed in this design document; the architectural count/bounded-work contracts above are already release requirements.

## Failure Behavior

Typed failure classes distinguish at least:

- invalid/missing Building access,
- no pedestrian route,
- no vehicle route,
- stale authoritative destination,
- topology-invalidated route,
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
- one-way/multiple Road Traffic profiles,
- freight/delivery/emergency vehicle trip classes,
- accessibility and congestion factors for RCI/Land Value/Economy,
- live incidents and dynamic rerouting,
- richer pedestrian destinations and public spaces.

These extend mode/profile/policy/projection registries without moving Road/Citizen/Building authority into Traffic.

## Acceptance Criteria

### Simulation truth

- Every active Traffic trip references one committed Mobility trip and one real Citizen.
- Every visible pedestrian is an active real Walk trip; every visible car is an active real Drive trip.
- No production acceptance relies on anonymous decorative fake Traffic.
- Off-screen materialization changes do not alter routes/progress/queues/trip count.
- Road/Building source authority remains upstream and transport graphs are rebuildable.
- Route planning is deterministic under equal inputs and tie conditions.
- New routes use lagged committed congestion costs mapped to the current graph; no same-tick feedback loop exists.
- Road topology/destination invalidation recovers/replans or fails deterministically from a valid stable anchor.
- Added equal-class load/queues cannot improve effective travel time under the same profile inputs.
- Save/load preserves the same committed logical route/progress checkpoint and equivalent future outcome.
- Sub-frame presentation interpolation is not Traffic authority.

### Visual product acceptance

A representative city with real Housing/Employment must visibly demonstrate:

```text
morning schedule window
→ Citizens leave Residential Buildings
→ Walk-mode Citizens appear on derived pedestrian corridors
→ Drive-mode Citizens appear as real cars on Roads
→ shared commute corridors gain visible/logical Traffic
→ node queues/congestion increase when demand exceeds service
→ Citizens arrive at real Workplace Buildings

return-home window
→ reverse commute becomes visible from the same real Citizen trips
```

Inspecting a visible person/car exposes the linked Citizen/trip identity. Camera movement/LOD cannot create or destroy logical commuters.

### Scale / integration acceptance

- At least 20,000 logical Citizens and 5,000 concurrent trips pass deterministic scale verification.
- Browser acceptance covers real Walk + Drive agents, congestion, Road mutation recovery, authoritative destination changes, Save/Load, Inspect, Traffic overlay, camera materialization, and WebGL/context restoration.
- Existing Road/Zoning/Building/RCI/Economy/City UI authority and browser contracts remain green unless an explicitly approved new contract changes them.

## PR Decomposition

Traffic-side delivery slices for the umbrella milestone:

1. Traffic core contracts, stable graph IDs/profiles, validation, `TrafficSaveV1` skeleton.
2. Pedestrian + vehicle graph projections from Road/Building access.
3. Deterministic multimodal routing and route-cache seam.
4. Active Traffic progression, node queues, load/congestion/travel-time projection.
5. Road topology / destination invalidation and deterministic route recovery.
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
