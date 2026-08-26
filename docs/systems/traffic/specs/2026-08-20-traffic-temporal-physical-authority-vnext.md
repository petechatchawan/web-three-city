# Traffic Temporal & Physical Authority vNext — Production Specification

**Status:** Review candidate — consolidated from approved architecture sections  
**System:** `traffic` with required contracts in `simulation-time`, `citizen-mobility`, and `apps/game` orchestration  
**Date:** `2026-08-20`  
**Supersedes for this scope:** hourly Traffic progression and presentation-owned journey replay/headway workarounds from Traffic Foundation v0.1 / PR3.1  
**Primary implementation target:** remediation and release closure after PR #83 owner visual failure

## 1. Decision Summary

Traffic vNext replaces coarse hour-batched transport and presentation-owned overlap/arrival workarounds with authoritative temporal and physical Traffic state.

The production authority chain becomes:

```text
Simulation calendar authority
absoluteGameMinute
        ↓
minute-boundary orchestration
        ↓
Citizen Mobility demand
        ↓
Traffic transport-time authority
        ↓
real active Walk/Drive trips
        ↓
Drive physical occupancy / reservations
        ↓
traffic-three interpolation + materialization
```

The design has six coordinated parts:

1. minute-resolution canonical calendar with legacy macro-hour compatibility;
2. authoritative Traffic transport microsteps between calendar boundaries;
3. explicit Drive lifecycle from `WaitingForEntry` through `Leaving`;
4. deterministic Citizen schedule distribution and departure staggering;
5. authoritative lane headway, entry admission, queueing, and spillback;
6. deterministic intersection/merge resource reservations with physical release.

The central invariant is:

> A visible Traffic agent is a materialization of a currently authoritative real Traffic trip. Presentation may smooth, pool, LOD, or omit that materialization, but it may not invent movement authority, repair canonical overlap, replay completed trips as new movement, or decide physical right-of-way.

This specification intentionally does not introduce full microscopic vehicle dynamics. Canonical acceleration physics, lane changing/overtaking, signals, roundabouts, parking, persistent vehicle ownership, freight, transit, and incidents remain later systems.

## 2. Problem Being Corrected

PR3.1 automated verification is green, but owner visual acceptance failed because the current architecture can produce visible vehicles that:

- are emitted in a synchronized batch even though Citizen schedules differ;
- exist only as short-trip journey replay after the real Traffic trip has already completed;
- overlap because canonical Traffic does not own longitudinal spacing;
- de-materialize because presentation cannot fit the requested visual headway;
- pop onto the first Road edge without an authoritative entry lifecycle;
- disappear or require a renderer-owned tail after canonical arrival;
- pass junctions using queue release slots without authoritative conflict-resource ownership.

The root cause is not only presentation geometry. Current Simulation advances one logical hour per player-facing tick, while Traffic can traverse short Road routes in integer seconds. A trip can therefore depart and arrive entirely inside one world tick and never exist as an authoritative active trip in a published state. Journey replay then recreates visible movement from receipts, but that synthetic path bypasses the real Traffic lifecycle and headway authority.

This vNext specification removes that temporal aliasing and moves physical movement constraints into `traffic-core`.

## 3. Authority Boundaries

### 3.1 `simulation-core`

Owns canonical calendar progression:

```text
absoluteGameMinute
revision
growthSequence
```

`macroHourIndex` is derived only:

```text
macroHourIndex = floor(absoluteGameMinute / 60)
```

The calendar remains the simple 24-hour / 30-day / 12-month calendar already used by the product.

### 3.2 `citizen-mobility-core`

Owns:

- Citizen desired activity/schedule;
- current stationary activity/location;
- Mobility trip identity/purpose/mode/status;
- `departureGameMinute`;
- at most one active Mobility trip per Citizen.

Mobility distributes demand but does not own Road capacity, headway, intersection service, or physical admission.

### 3.3 `traffic-core`

Owns:

- transport-time cursor;
- logical Walk/Drive route progression;
- Drive lifecycle phase;
- entry queue state;
- canonical longitudinal vehicle ordering/headway;
- physical receiving/ingress/merge/conflict reservations;
- intersection traversal progress;
- deterministic queue/arbitration state;
- topology recovery/failure;
- Traffic persistence and validation.

`traffic-core` remains framework-independent and must not import Three.js, DOM, RCI, Road implementation state, Building implementation state, or Citizen Mobility implementation state. `apps/game` supplies narrow source projections and performs cross-system atomic composition.

### 3.4 `traffic-three`

Owns only derived presentation state:

- materialization/LOD/pooling;
- route/path geometry;
- visual interpolation and bounded kinematic smoothing;
- transform, tangent heading, wheel/body presentation;
- visual omission for camera/LOD/budget reasons.

It must not own canonical spacing, entry admission, queue order, conflict ownership, arrival lifecycle, or synthetic trip replay.

### 3.5 `apps/game`

Owns cross-system ordering and atomic world publication. A world transaction may update only Traffic/Mobility while Simulation minute remains unchanged; every committed subdomain state must still satisfy world validation.

## 4. Temporal Foundation

### 4.1 Canonical calendar

The canonical player/world calendar becomes minute-resolution:

```text
SimulationSnapshotVNext
- revision
- absoluteGameMinute
- growthSequence
```

Calendar fields are derived from `absoluteGameMinute`.

No subsystem may treat a terrain/render frame, wall-clock time, or Traffic transport step as the canonical game calendar.

### 4.2 Macro-hour compatibility

Building, RCI, and Economy currently encode hour-based semantics. vNext preserves those semantics through a derived macro-hour boundary rather than reinterpreting their existing durations as minutes.

```text
macroHourIndex = floor(absoluteGameMinute / 60)
```

A minute transition that leaves `macroHourIndex` unchanged must not invoke hourly Building/RCI/Economy work merely because the calendar revision advanced.

Example:

```text
08:00 → 08:01 → ... → 08:59
macroHourIndex remains 8

08:59 → 09:00
macroHourIndex becomes 9
```

This prevents construction, RCI lifecycle, and Economy settlement from running 60 times more frequently after the calendar cutover.

### 4.3 Traffic transport time

Traffic owns a subordinate deterministic transport clock. It is not a second calendar authority.

Conceptually:

```text
TrafficTimeCursor
- sourceGameMinute
- completedTransportQuantaWithinMinute
- absoluteTransportSecond
- temporalPolicyVersion
```

`absoluteTransportSecond` is Traffic simulation time used by route travel, queues, and reservations. Calendar minute and Traffic second are related through a versioned pacing policy.

Initial vNext pacing target:

```text
Normal:
1 GameMinute / 1 real second

Traffic:
4 authoritative TransportSeconds / GameMinute

Fast:
2× calendar + Traffic progression

Faster:
4× calendar + Traffic progression
```

The exact ratio is a versioned pacing parameter, not Road capacity and not a population-dependent value. Population changes transport demand only; it never changes canonical Traffic-time semantics.

Runtime may batch multiple deterministic quanta for performance only when the result is equivalent to executing those quanta one-by-one in order.

### 4.4 Pause and Step

`paused` freezes:

- `absoluteGameMinute`;
- Traffic transport cursor;
- trip progression;
- entry/intersection queues;
- physical reservations.

Player-facing `Step` advances exactly one GameMinute and deterministically executes all Traffic transport quanta belonging to that minute. It is not a one-TransportSecond debugger command.

## 5. Temporal Ordering and Atomic World Transactions

There are two authoritative transaction classes.

### 5.1 Minute Boundary Transaction

For `M-1 → M`:

```text
Committed World @ M-1
        ↓
advance absoluteGameMinute to M
        ↓
if macro boundary is due:
  Building / construction / growth
        ↓
RCI lifecycle + demand
        ↓
reconcile latest Citizen/Home/Work authority
        ↓
resolve Mobility schedule boundaries due at M
        ↓
create real Traffic trips at WaitingForEntry / active Walk start
        ↓
run Economy scheduled work when due
        ↓
validate entire staged world
        ↓
ATOMIC COMMIT
```

Upstream authority must be evaluated before downstream trip intent. A Citizen may not depart toward a Work/Home assignment that was invalidated earlier in the same boundary transaction.

A trip due at `08:15` becomes an active Mobility/Traffic trip at the `08:15` boundary. It does not wait until `08:16`, but a Drive trip does not spawn directly onto the Road during the minute transaction.

### 5.2 Transport Quantum Transaction

Within one GameMinute, each Traffic quantum executes deterministically:

```text
1. reconcile cancellation / invalid topology
2. service existing conflict/merge queues
3. service WaitingForEntry admission candidates
4. advance Entering
5. advance ordinary lane Travelling under headway
6. create newly reached junction queues
7. advance active junction/merge traversal
8. advance Leaving
9. settle completed Traffic arrivals with Mobility
10. advance Traffic time cursor
11. validate staged world
12. ATOMIC COMMIT
```

A newly created intersection queue entry is not released in the same quantum in which it was created.

One trip may cross at most one major lifecycle boundary per quantum. `WaitingForEntry → Entering → Travelling` may not collapse into one commit, and `Travelling → Leaving → Arrived` may not collapse into one commit.

### 5.3 Arrival atomicity

When a Traffic trip completes its physical `Leaving` phase, the same atomic world publication must:

```text
Traffic:
remove/terminalize the active transport trip

Mobility trip:
Active → Arrived

CitizenMobilityState:
Travel → Home | Work
activeTripId → null
stationaryBuildingId → destination
```

No committed world may contain a logically completed/missing Traffic trip while the linked Mobility/Citizen still claims the trip is active.

### 5.4 Failure atomicity

If any staged domain or world validation fails, no partial subdomain publication survives. The previous committed world remains authoritative.

## 6. Drive Trip Lifecycle

Traffic trip terminal status and movement phase are separate concepts.

```text
TrafficTripStatus
Active | Arrived | Failed | Cancelled

DriveMovementPhase while Active
WaitingForEntry | Entering | Travelling | Leaving
```

Invariant:

```text
status == Active
→ movementPhase != null

status != Active
→ movementPhase == null
```

Canonical lifecycle:

```text
Mobility departure
      ↓
Traffic Active / WaitingForEntry
      ↓
Traffic Active / Entering
      ↓
Traffic Active / Travelling
      ↓
Traffic Active / Leaving
      ↓
atomic Traffic + Mobility arrival settlement
```

### 6.1 WaitingForEntry

A Drive trip exists before it occupies a Road lane. It retains deterministic origin-access identity and queue ordering facts.

A blocked vehicle stays `WaitingForEntry`; it is not represented as a canonical vehicle stacked at progress zero and it is not hidden as a substitute for Traffic capacity.

### 6.2 Entering

Entry admission acquires physical reservation resources before the vehicle begins its access-to-lane transition. `Entering` is an authoritative physical state, not a Three.js animation timer.

Logical ingress duration/progress is derived deterministically from access geometry and a versioned Traffic policy. Presentation may render a smoother access curve but must follow the same canonical progress.

### 6.3 Travelling

Normal Road traversal uses canonical route/segment/progress and Traffic seconds. Longitudinal headway, queues, spillback, merge/intersection resources, and route recovery are all Traffic authority.

Intersection waiting remains orthogonal queue/traversal state inside `Travelling`; it is not a new top-level lifecycle phase.

### 6.4 Leaving

Completing the final Road edge does not immediately complete the Traffic trip. The trip becomes `Leaving` and remains authoritative while the logical vehicle clears the destination frontage/access transition.

Only after the complete logical vehicle envelope clears the destination egress footprint may Traffic arrive and Mobility settle.

This removes the normal need for a renderer-owned arrival tail.

## 7. Walk Trip Temporal Contract

The minute/transport-time cutover applies to Walk trips as well as Drive trips. Short Walk trips must remain real authoritative trips across published transport checkpoints rather than being reconstructed by a synthetic replay receipt.

Physical vehicle headway, ingress reservation, merge resources, and vehicle conflict zones are Drive-only in this vNext scope. Existing deterministic pedestrian routing/access geometry remains the Walk path authority unless a later pedestrian-density system introduces its own occupancy model.

## 8. Schedule Distribution and Departure Smoothing

### 8.1 Stable routine plus deterministic daily variation

Mobility schedule vNext separates a stable personal commute base from small day-specific jitter.

```text
baseDeparture = deterministic hash(citizenId, seedVersion, policyVersion)
dailyJitter   = deterministic hash(citizenId, dayIndex, purpose, policyVersion)
```

No runtime RNG, wall clock, frame count, input array order, or Traffic congestion may alter schedule timing.

### 8.2 Morning distribution

The vNext morning commute window remains `07:00–08:59` but uses a deterministic weighted distribution rather than a flat re-roll over the full window every day.

Initial policy target:

```text
07:00–07:29  15%
07:30–07:59  30%
08:00–08:29  35%
08:30–08:59  20%
```

Base schedule placement reserves edge room for morning daily jitter:

```text
base range: 07:05–08:54
morning daily jitter: -5..+5 minutes
```

The exact bucket implementation is integer/deterministic and versioned.

### 8.3 Return commute and work-duration invariant

Nominal work duration remains 540 minutes. Return variation uses an independent deterministic namespace but must satisfy the explicit policy invariant:

```text
NOMINAL_WORK_DURATION_MINUTES = 540
MAX_WORK_DURATION_DEVIATION_MINUTES = 15

525 <= actual scheduled work interval <= 555 minutes
```

Initial return jitter target is `-10..+10` minutes. Policy validation must ensure morning/return jitter bounds cannot compound beyond the declared maximum work-duration deviation.

### 8.4 One active trip per Citizen

At all times:

```text
active Mobility trips per Citizen <= 1
active Traffic trips per Citizen <= 1
```

If a later schedule boundary becomes due while that Citizen is still travelling:

- do not create a second Mobility trip;
- do not preempt the current trip;
- do not create duplicate Traffic demand;
- do not accumulate a historical queue of missed trip commands.

After the current trip settles, Mobility re-evaluates the Citizen's desired activity at the current GameMinute. If current location/activity does not match current desired activity, create at most one deterministic catch-up intent.

Schedule boundaries are desired-activity signals, not a durable backlog of historical commands.

### 8.5 Transport-offset staggering

Citizens sharing one `departureGameMinute` may derive different deterministic transport offsets inside that minute. The offset is derived from stable Citizen/trip/policy inputs and the active temporal pacing policy.

It is not persisted as independent Mobility authority. Once the Traffic trip exists, Traffic queue/admission state and Traffic time cursor are authoritative for resume.

Temporal resolution never acts as Road or Building access capacity.

### 8.6 API naming

`workStartGameMinuteForCitizen()` is replaced by semantically accurate commute-departure naming, e.g. `commuteDepartureGameMinuteForCitizen()`.

This helper rename is compile-time only. Function names are not serialized Save data.

## 9. Authoritative Vehicle Envelope and Headway

### 9.1 Canonical units

Traffic core uses canonical world millimeters. Do not copy the existing PR3.1 presentation constant `650 mm` directly into canonical headway policy: current `traffic-three` presentation spacing uses a compressed rendered Road-cell scale, whereas canonical Road traversal uses the real 8m gameplay cell scale.

Canonical vehicle length, standstill gap, and following headway values must be calibrated in `traffic-core` world millimeters from Road/vehicle spatial standards.

Three.js mesh bounds are never gameplay authority.

### 9.2 Vehicle envelope policy

A versioned policy defines at minimum:

```text
VehicleEnvelopePolicy
- logicalVehicleLengthMm
- standstillGapMm
- followingTimeHeadwayMilliSeconds or equivalent integer duration
```

Required longitudinal front-to-front spacing is derived deterministically from logical vehicle envelope and Road design/free-flow speed, not live congestion speed.

Conceptually:

```text
requiredHeadway =
vehicleLength
+ max(standstillGap,
      designSpeed × followingTimeHeadway)
```

Exact integer arithmetic and constants are policy-versioned and test-calibrated.

### 9.3 Physical lane span authority

Two vehicles occupying the same physical directional lane span share headway authority regardless of their downstream route identity.

Lane continuation metadata is used to find downstream leaders across Road-edge boundaries; it does not partition vehicles into independent spacing groups.

Headway therefore applies across:

- adjacent straight Road edges;
- simple Road bends;
- the shared upstream portion of a diverge;
- downstream receiving spans after merge/junction admission.

For diverges, vehicles share headway until the physical divergence point, then independent spans may progress independently.

### 9.4 Progression ordering

Per transport step, canonical occupancy is processed deterministically front-to-back / leader-first. Tie-breaking may not rely on array iteration.

Conceptually:

```text
candidatePosition = normal Traffic progression
safePosition      = leaderPosition - requiredHeadway
committedPosition = min(candidatePosition, safePosition)

committedPosition >= previousPosition
```

Normal runtime never moves a vehicle backward to repair an overlap. A current-schema state containing canonical overlap is invalid.

### 9.5 Queue and spillback

A stopped leader constrains the follower, which constrains the next follower. Queue storage may propagate across Road-edge boundaries and prevent upstream intersection/merge release.

Flow capacity, physical storage clearance, intersection service capacity, and Building access service capacity are distinct concepts. Existing `capacityUnits` may continue to drive flow/congestion projection but must not be reinterpreted as “number of physical cars that fit on one 8m edge.”

## 10. Building Access Admission and Ingress Reservation

### 10.1 Static access service

`accessServiceRate` is a static versioned Traffic policy value derived from access/Road class. It must not be modulated by:

- live congestion;
- load ratio;
- queue length;
- current vehicle speed;
- population.

Service credit may accumulate deterministically from elapsed Traffic time, but physical admission requires atomic resources.

### 10.2 Atomic entry resource bundle

A `WaitingForEntry → Entering` transition attempts one atomic reservation bundle, conceptually:

```text
{
  IngressFootprint(accessId),
  ReceivingAdmission(firstPhysicalLaneSpan)
}
```

The complete bundle must be available and acquired atomically. A read-only “lane looks empty” check is insufficient.

A congested/full downstream lane blocks acquisition through physical occupancy; it does not change the static service-credit rate.

### 10.3 Reservation release

Ingress/receiving reservation release is physical-envelope based:

```text
front enters footprint → occupied
body remains in footprint → occupied
rear clears footprint → release
```

Changing movement phase alone does not release the resource. There is no timeout-based release.

If an entering vehicle stalls because of downstream spillback while its rear still occupies the ingress footprint, later queued vehicles remain blocked. This is expected physical backpressure, not a deadlock to bypass.

Cancellation/failure/topology recovery may release a reservation only in the same atomic transaction that authoritatively removes or relocates the occupying trip.

## 11. Unified Traffic Reservation Model

All physical exclusive resources use one reservation lifecycle:

```text
TrafficReservationResource
├─ IngressFootprint
├─ ReceivingAdmission
├─ MergeAdmission
└─ IntersectionConflictZone
```

For all resource types:

- deterministic resource identity;
- full bundle derived before grant;
- atomic all-or-nothing acquire;
- no partial ownership;
- normal release only after logical vehicle-envelope clearance;
- no timeout release;
- no presentation-owned release.

Global owner indexes are derived from authoritative trip traversal/reservation facts and are not separate persisted authority.

## 12. Drive Node Classification

Node classification occurs before movement classification.

Every relevant Drive graph node is deterministically classified from canonical directed graph connectivity and a versioned topology policy:

```text
SimpleContinuation
Diverge
Merge
ConflictJunction
```

### 12.1 SimpleContinuation

Ordinary straight continuation or non-conflicting degree-2 bend. Uses normal headway/progression. No reservation arbitration.

### 12.2 Diverge

Shared upstream physical span keeps ordinary headway until the divergence point. If downstream paths are physically independent, no artificial intersection reservation/service queue is introduced.

### 12.3 Merge

Multiple incoming spans compete for a shared downstream receiving path. The front-most eligible candidate on each incoming span requests a bundle containing `MergeAdmission` and required `ReceivingAdmission` resources.

`MergeAdmission` uses exactly the same atomic-acquire, physical-release, no-timeout lifecycle as intersection conflict resources.

### 12.4 ConflictJunction

T-junction / 4-way style topology where movements can cross or compete inside a junction. Only this class derives full intersection movement classification and conflict templates.

## 13. Intersection Movement and Conflict Resources

### 13.1 Movement identity

For `ConflictJunction`:

```text
IntersectionMovementKey
= nodeId + incomingEdgeId + outgoingEdgeId
```

Derived movement kind:

```text
Straight | Left | Right
```

Immediate U-turn generation remains out of vNext scope.

### 13.2 Conflict templates

A versioned `IntersectionConflictPolicy` maps graph topology/movement to an ordered set of logical conflict resource IDs. It does not depend on Three.js curves, mesh polygons, or runtime collision tests.

Two movements conflict when their complete reservation bundles share an exclusive resource.

### 13.3 Receiving admission is a reservation, not a check

A junction candidate's resource bundle includes both conflict resources and the downstream receiving insertion footprint.

Conceptually:

```text
{
  ConflictZone(...),
  ConflictZone(...),
  ReceivingAdmission(outgoingPhysicalSpan)
}
```

Two movements with disjoint geometric conflict zones still cannot be granted together if they compete for the same receiving insertion resource.

The receiving reservation covers only the logical insertion footprint required to clear the junction safely; it does not reserve the full outgoing Road route.

### 13.4 All-or-nothing grant

Arbitration requests the complete resource bundle before the vehicle enters the junction. If any required resource is unavailable, the vehicle remains queued and acquires nothing.

This prevents cyclic partial-reservation deadlock.

### 13.5 Canonical junction traversal

A granted vehicle owns authoritative traversal state, conceptually:

```text
ActiveNodeTraversal
- nodeId
- traversalClass
- incomingEdgeId
- outgoingEdgeId
- movementKind?          // ConflictJunction only
- reservedResourceIds[]
- progressQ
```

The top-level trip remains `movementPhase = Travelling`.

Logical traversal distance/speed are deterministic integer/fixed-point Traffic policy values derived from Road/topology semantics, not Three.js Bézier arc length or render-frame delta.

The complete reservation bundle remains held until the logical vehicle's rear envelope clears the reservation footprint. vNext deliberately favors conservative full-bundle release over partial zone-by-zone release.

## 14. Deterministic Arbitration and Starvation

Only the front-most eligible queued vehicle on each physical incoming lane span may enter arbitration. A rear vehicle may not virtually overtake a blocked front vehicle even if its turn movement has a higher base priority.

Candidate ordering is deterministic and starvation-safe. Initial policy uses movement priority plus bounded age promotion.

Conceptually:

```text
1. starvation/service class derived from waiting age
2. queuedAtTransportSecond
3. base movement priority
4. tripId
```

Waiting age thresholds are versioned integer policy values. Continuous straight traffic must not starve a waiting left-turn forever.

Within an arbitration cycle, grants are built deterministically as a maximal compatible set over complete reservation bundles. A candidate can be granted only if its full bundle does not conflict with resources already owned or granted earlier in the same cycle.

Traffic congestion projections do not grant special arbitration priority except through the explicit versioned waiting-age rule.

## 15. Road Mutation and Recovery

Road mutation may invalidate remaining routes, accesses, node classification, or reservation templates.

A topology transaction must not expose an occupied physical resource to another vehicle until the previous occupant has been atomically resolved.

For active entry/junction traversal:

```text
topology still valid
→ continue with reconciled derived indexes

invalid topology
→ deterministic recovery / failure / cancellation
   plus reservation resolution
   in one atomic transaction
```

There may be no orphan reservation and no canonical vehicle left in a resource that the new graph treats as free.

## 16. Presentation Cutover

### 16.1 Delete synthetic journey replay authority

The normal Traffic presentation path after vNext is:

```text
real Mobility trip
      ↓
real Traffic trip
      ↓
authoritative transport checkpoints
      ↓
traffic-three interpolation
```

The existing synthetic short-trip journey replay mechanism, replay vehicle/pedestrian pools, replay wall-clock timing constants, and replay-generated movement are delete candidates and must not remain as a second movement authority after cutover.

Short trips are made visible by authoritative temporal granularity, not by replaying completed receipts.

### 16.2 Presentation headway after cutover

Canonical non-overlap is enforced in `traffic-core` before presentation.

`traffic-three` may smooth toward committed safe positions but may not:

- pull a vehicle ahead of its canonical safe target;
- move canonical Traffic state;
- reorder canonical vehicles;
- de-materialize a vehicle as the solution to canonical Road capacity;
- create a second physical-spacing authority.

Materialization may still be omitted for camera/LOD/renderer budget reasons without changing Traffic fingerprints.

### 16.3 Terminal presentation

A Drive trip remains canonical through `Leaving`, so ordinary destination egress does not require a presentation-owned route tail after logical completion. No completed trip may be restarted from its origin as visual replay.

## 17. Persistence and Migration

The temporal/lifecycle/reservation cutover changes authoritative state and therefore requires explicit versioned Save migration. No current-schema load may silently reinterpret old fields.

### 17.1 Required schema direction

Implementation is expected to introduce:

```text
SimulationSaveV3
- minute calendar authority

MobilitySaveV2
- schedule policy v2 semantics

TrafficSaveV2
- transport cursor
- Drive movement phase
- entry / node traversal reservation facts
- transport-time queue timestamps

WorldSaveV8
- composes the new child Save versions
```

The exact TypeScript type names may differ only if repository conventions require an equivalent explicit version boundary. Silent semantic reuse of old schema versions is not allowed.

### 17.2 Simulation V2 → V3

Old hourly state migrates deterministically:

```text
absoluteGameMinute = old.absoluteTick * 60
```

Existing revision/growth-sequence semantics are preserved. `macroHourIndex` remains derived and is not a second persisted calendar authority.

### 17.3 Mobility V1 → V2

Migration preserves:

- Citizen current activity/stationary location;
- active trip identity/state;
- trip sequence;
- existing committed `departureGameMinute` for already-created trips.

Future schedule boundaries adopt schedule policy v2 from the migration calendar checkpoint. Migration must not replay historical missed departures. If a Citizen already has an active trip, the one-active-trip invariant remains authoritative and desired activity is re-evaluated only after settlement as specified above.

### 17.4 Traffic V1 → V2

Existing active trips preserve real trip identity, Citizen identity, route identity, and maximum forward progress. Existing active Drive trips that are already on a Road route migrate into a valid `Travelling` state; migration must not pretend they were still at Building entry.

Legacy queued-movement `arrivedAtGameSecond` values belong to the old hour-derived clock. They must be deterministically rebased into the new Traffic transport timeline while preserving queue order/age ordering. They must not be numerically reinterpreted as vNext transport seconds.

### 17.5 One-time legacy overlap normalization

Pre-vNext Traffic state may contain positions that violate new canonical headway because physical spacing was previously presentation-only.

Only during explicit V1→V2 migration:

1. derive physical lane occupancy;
2. sort vehicles deterministically front-to-back;
3. preserve leader position;
4. move followers backward along their existing route only as needed to restore canonical headway;
5. never advance a migrated vehicle farther than its old committed progress;
6. if route-origin storage is insufficient, deterministically return overflow Drive trips to `WaitingForEntry` rather than persist overlap.

Current-schema V2 runtime never performs backward repair. A V2 Save containing canonical overlap fails validation rather than being silently normalized.

### 17.6 Save checkpoint determinism

Save captures committed world state only. It may occur after any completed minute or transport transaction.

If Save occurs at GameMinute `M` after transport quantum `Q`, Load resumes from that exact committed cursor; it does not restart `M` from Q0 and does not skip to `M+1`.

Required equivalence:

```text
continuous execution fingerprint
==
save/load/resume execution fingerprint
```

for Simulation, Mobility, Traffic, queues/reservations, Building/RCI/Economy macro behavior, and world state.

Derived indexes such as lane occupancy maps, leader lookups, conflict compatibility matrices, and resource-owner maps are rebuilt after Load from authoritative snapshots.

## 18. Performance Contract

Target logical scale remains at least:

- 20,000 Citizens;
- 5,000 concurrent trips;
- existing bounded materialized pedestrian/vehicle budgets.

vNext must not introduce O(n²) all-vehicle comparisons per transport step.

Expected mechanisms:

```text
active trips
→ edge / physical-lane occupancy buckets
→ local deterministic ordering
→ neighbor lookup
```

and per Traffic graph revision:

```text
Drive node classification
movement keys
conflict resource templates
compatibility/resource metadata
```

are precomputed/derived outside render-frame hot paths.

Runtime arbitration uses front candidates plus resource-set checks, not geometric collision tests across all vehicles.

Presentation materialization remains decoupled from logical trip count.

## 19. Explicit Non-Goals

This vNext does not add:

- canonical acceleration/deceleration vehicle dynamics beyond deterministic progression limits;
- lane changing or overtaking;
- one-way Road gameplay or multi-lane avenue lane selection;
- Traffic lights, stop signs, player signal control, or signal phases;
- roundabouts;
- parking, pull-in/pull-out parking lifecycle, persistent vehicle ownership;
- transit, freight, emergency vehicles, accidents/incidents;
- congestion-responsive Citizen departure planning;
- congestion-triggered ordinary mid-trip rerouting;
- pedestrian crowd headway/collision simulation;
- Three.js geometry as simulation authority.

## 20. Production Invariants

The implementation must preserve all of the following:

```text
Calendar
- absoluteGameMinute is the canonical calendar authority.
- Traffic transport time is subordinate and versioned.
- Population never changes canonical transport-time semantics.
- Building/RCI/Economy do not silently execute ×60.

Trips
- Every visible normal Traffic agent corresponds to a real authoritative trip.
- One Citizen has at most one active Mobility trip and one linked active Traffic trip.
- Missed schedule boundaries do not accumulate duplicate historical trips.
- A Drive trip does not spawn directly onto a Road lane.
- A Drive trip does not become Arrived before canonical Leaving completes.

Atomicity
- Arrival settles Traffic + Mobility + Citizen state atomically.
- Failed staging leaves the previous committed world intact.
- A trip crosses at most one major lifecycle boundary per transport quantum.

Physical Traffic
- Canonical non-overlap is Traffic authority, not presentation authority.
- Different routes sharing one physical lane span still share headway.
- Flow capacity, storage, access service, and intersection service are separate dimensions.
- Temporal quantum count is never physical Road capacity.
- Blocked vehicles wait; Traffic does not solve capacity by hiding them.

Reservations
- Ingress, Receiving, Merge, and Conflict resources use one lifecycle.
- Complete reservation bundles acquire atomically or not at all.
- Downstream receiving storage is an atomic reservation claim, not a read-only check.
- Normal release is physical-envelope based.
- No physical reservation has a timeout.
- Topology mutation cannot orphan an occupied resource.

Determinism
- Runtime RNG/frame order does not affect schedules, queue order, headway, or arbitration.
- Valid current-schema Save/Load preserves position/order/reservations exactly.
- Legacy overlap repair occurs only in an explicit schema migration.

Presentation
- traffic-three may smooth, pool, LOD, or omit visuals only.
- Presentation cannot create a second spacing/right-of-way authority.
- Journey replay is not used to recreate normal completed trips.
```

## 21. Required TDD Acceptance Matrix

The implementation plan must create RED evidence before GREEN changes for at least the following behavior families.

### Temporal / orchestration

- `absoluteGameMinute` advances by one without running macro-hour consumers every minute;
- `macroHourIndex` changes only on hour boundaries;
- old hourly Simulation Save migrates hour `8` to minute `480`;
- Traffic-only world publication can occur while Simulation minute is unchanged;
- pause freezes both calendar and Traffic transport state;
- player Step advances one minute plus all deterministic transport quanta;
- continuous vs Save/Load-resumed execution produces identical fingerprints.

### Schedule / Mobility

- stable personal base + bounded day jitter is deterministic;
- weighted commute distribution is stable for same state/day/policy;
- effective scheduled work interval remains 540 ±15 minutes;
- no Citizen gets a second active trip when a later boundary is due;
- settlement re-evaluates current desired activity without replaying historical boundaries;
- helper rename has no serialized field impact.

### Lifecycle / replay removal

- a short Drive route remains a real authoritative active lifecycle across published checkpoints;
- a short Walk route is not reconstructed from a synthetic receipt replay;
- Drive `WaitingForEntry`, `Entering`, `Travelling`, `Leaving` are observable committed states;
- no trip crosses multiple major phases in one quantum;
- Journey Replay counts/classes are removed or permanently zero on production path;
- no completed trip restarts visually from origin.

### Headway / entry / spillback

- same-lane vehicles never violate canonical headway;
- headway remains valid across Road-edge and simple-turn boundaries;
- diverging routes sharing the upstream physical span remain constrained until divergence;
- blocked first lane keeps trip `WaitingForEntry`;
- ingress + receiving resources are acquired atomically;
- stalled ingress vehicle retains reservation until its rear clears;
- no timeout releases occupied ingress;
- stopped leader creates deterministic upstream queue/spillback;
- materialization on/off does not alter Traffic fingerprint.

### Intersection / merge

- node classification correctly separates continuation/diverge/merge/conflict junction;
- perpendicular conflicting movements cannot own overlapping resources;
- fully independent movements may proceed concurrently;
- compatible conflict-zone movements sharing one receiving lane cannot both acquire receiving admission;
- one unavailable resource causes zero partial acquisition;
- same incoming lane cannot virtually overtake the front queued vehicle;
- waiting age promotion prevents indefinite starvation;
- full downstream receiving storage blocks grant;
- merge approaches serialize shared receiving admission;
- simple diverge does not receive an artificial service queue;
- occupied conflict/merge resources survive Save/Load with same ownership;
- Road mutation cannot orphan active reservation.

### Legacy migration

- overlapping TrafficSaveV1 state migrates deterministically to headway-valid V2;
- migration preserves trip identity and never moves a trip forward;
- migration overflow returns deterministic followers to `WaitingForEntry`;
- valid V2 reload performs no positional normalization;
- invalid overlapping V2 input is rejected;
- old intersection queue timestamps rebase while preserving ordering.

## 22. Release and Verification Gate

This specification exists because automated correctness alone did not satisfy owner visual acceptance. Release closure therefore requires both automated and owner-controlled evidence.

Minimum final gate after implementation:

1. focused RED/GREEN package evidence;
2. owning package tests/typechecks for `simulation-core`, `citizen-mobility-core`, `traffic-core`, `traffic-three`, and Game orchestration as changed;
3. dependent-consumer verification required by repository dependency policy;
4. targeted Chromium `@traffic|@road` behavior verification;
5. Save migration and Save/Load equivalence verification;
6. deterministic 5,000-concurrent-trip scale evidence without world-wide O(n²) vehicle comparison;
7. 414×896 owner visual/manual acceptance showing staggered real departures, no same-lane overlap, no origin/destination pop, no synthetic batch replay, correct queue/spillback, and no conflicting junction overlap;
8. exact-head release CI / Sonar / clean-worktree evidence required by repository policy;
9. only after the exact candidate passes all gates may PR #83 move from Draft to Ready and be merged.

## 23. Documentation Cutover Required With Implementation

When implementation changes behavior, ownership, public contracts, or Save schema, the same implementation PR must update the living handoffs for at least:

- `docs/systems/simulation-time/README.md`;
- `docs/systems/citizen-mobility/README.md`;
- `docs/systems/traffic/README.md`;
- system-specific ADRs for calendar/transport authority and physical reservation authority if existing ADRs cannot be amended cleanly;
- system-specific TDD/verification documents.

Living docs must describe current shipped behavior only. This review-candidate specification may describe the approved target before implementation.

## 24. Implementation Sequencing Constraint

Implementation must not begin as an unstructured broad rewrite. After this specification is owner-reviewed and approved, produce a detailed TDD implementation plan with explicit package/file ownership, migration slices, RED tests, GREEN changes, verification commands, stop conditions, and exact-head release evidence.

Recommended dependency order for that future plan:

```text
minute calendar + compatibility
        ↓
Traffic transport cursor / atomic quantum publication
        ↓
Mobility schedule v2 + one-active-trip rules
        ↓
Drive lifecycle + SaveV2
        ↓
remove journey replay
        ↓
canonical headway / entry reservations
        ↓
node classification / merge / junction reservations
        ↓
legacy migrations
        ↓
presentation cutover
        ↓
targeted browser + scale + owner visual gate
        ↓
exact-head release closure
```

No production implementation is authorized by this document alone until the consolidated specification review is accepted and the TDD plan is subsequently approved.