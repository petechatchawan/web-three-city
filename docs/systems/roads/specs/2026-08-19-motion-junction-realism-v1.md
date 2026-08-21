# Motion & Junction Realism v1

**Status:** Draft for owner review  
**Baseline:** `master@377ea016a0c537f57aa2cfff27bd622e03a6b060` after PR3 Lane-aware Traffic  
**Delivery slice:** PR3.1  
**Primary systems:** Traffic presentation, Road presentation, Three.js motion  
**Preserved authorities:** Road, Traffic, Citizen Mobility

## Goal

Improve the visible Road/Traffic motion established by PR3 without changing canonical Traffic simulation semantics.

PR3.1 must make moving vehicles visibly behave like vehicles rather than markers moving between logical snapshots:

- turning trajectories follow continuous curves;
- acceleration and deceleration are visually progressive rather than instantaneous;
- vehicles reduce visual speed before and through turns;
- vehicle heading follows the route tangent continuously;
- 90-degree Road corner cells show lane/center markings that follow the corner geometry.

The target is believable mobile city traffic, not a microscopic vehicle-dynamics simulator.

## Product acceptance

At the canonical 414×896 mobile presentation, a representative vehicle must visibly:

1. accelerate away from a slow/stopped state without an immediate velocity jump;
2. approach a 90-degree corner with visible speed reduction;
3. follow a continuous turn path rather than an angular 45/90-degree heading step;
4. maintain continuous body heading aligned with the route tangent;
5. accelerate smoothly after leaving the turn;
6. travel on a Road corner whose visible center/lane marking follows the bend rather than disappearing.

Straight-road traffic, opposing left-hand lane separation, Local/Collector/Arterial identity, route identity, logical arrival, queue authority, and save semantics from PR3 remain unchanged.

## Authority boundary

PR3.1 is explicitly a **presentation-only kinematics** slice.

```text
Canonical Traffic
routeEdgeIds
progressQ
queued
trip status
traffic revision
        ↓
PR3 DirectedLanePath
        ↓
Prepared Motion Path
line + cubic junction segments
        ↓
Presentation Kinematics Follower
visual distance
visual speed
turn-speed envelope
        ↓
Path tangent
        ↓
Three.js vehicle transform
```

Invariants:

- canonical Traffic progress remains the authoritative trip-progress target;
- presentation may lag canonical progress by a bounded amount while smoothing motion;
- presentation never advances Traffic progress, changes trip timing, changes congestion, or commits queue state;
- presentation never changes Road speed/capacity semantics;
- vehicle meshes and visual speed are never persisted;
- PR3.1 does not introduce Vehicle Life authority;
- a presentation-only curve is not a new Traffic route authority.

The same logical simulation must produce the same Traffic state at 1×, 2×, and 4×. PR3.1 changes only how committed state is visually followed between snapshots.

## Existing seams and required cutover

PR3 currently has the correct lane-aware topology but three presentation seams remain:

1. `intersection-lane-connector.ts` computes a cubic Bézier but immediately flattens it into a small number of straight segments;
2. `TrafficPresentation` linearly interpolates route distance between committed snapshot targets, so velocity can change abruptly at reconciliation boundaries;
3. `lane-marking-geometry.ts` emits center-divider geometry only for pure north/south or east/west cells, so orthogonal corner cells have no corresponding curved marking.

PR3.1 must improve those seams without moving canonical authority.

## Junction curve contract

### Curve primitive

A turn connector is represented in prepared presentation geometry as a deterministic cubic Bézier primitive:

```ts
export interface TrafficCubicCurveQ {
  readonly p0: TrafficWorldPointQ;
  readonly p1: TrafficWorldPointQ;
  readonly p2: TrafficWorldPointQ;
  readonly p3: TrafficWorldPointQ;
}
```

The connector enters at `p0` with a tangent parallel to the incoming lane and exits at `p3` with a tangent parallel to the outgoing lane.

The curve must remain inside the existing PR3 junction envelope.

### Source-edge attribution

Canonical routing remains edge-based. A curved connector may be split deterministically at `t = 0.5` using de Casteljau subdivision so that:

- the first half remains attributed to the incoming canonical source edge;
- the second half remains attributed to the outgoing canonical source edge;
- `DirectedLanePathEdgeSpan` remains usable for canonical progress → presentation-distance projection;
- no new canonical edge identity is introduced.

### Continuity

The lane-to-connector and connector-to-lane joins must be at least C1-continuous in horizontal heading:

```text
incoming lane tangent == connector start tangent
connector end tangent == outgoing lane tangent
```

Position continuity is mandatory. A visible car must not jump when entering or leaving a connector.

### Curve length

Prepared curve length is a deterministic approximation produced during route preparation, not every frame. Adaptive or fixed deterministic subdivision is acceptable provided:

- identical input produces identical length;
- route length is stable across frames;
- sampling allocates no new route geometry during RAF;
- the approximation error is small enough that visible speed does not noticeably change at line/curve boundaries.

Recommended implementation: deterministic 8- or 12-step arc-length lookup per cubic half prepared once per route reconciliation.

## Prepared motion path

`traffic-three` extends prepared route geometry so a route may contain:

```ts
export type PreparedMotionSegment =
  | Readonly<{ kind: 'line'; ... }>
  | Readonly<{ kind: 'cubic'; curve: TrafficCubicCurveQ; ... }>;
```

Each prepared segment exposes:

- cumulative start/end distance;
- deterministic source-edge identity;
- movement kind: `straight | turn-left | turn-right`;
- position sampling by distance;
- tangent/heading sampling by distance.

The hot frame path receives a prepared route and reusable output objects. It must not rebuild Bézier controls, route spans, or arc-length tables per frame.

## Continuous position and heading

### Position

Straight segments use linear distance sampling. Cubic segments sample the Bézier by arc-length lookup so equal route-distance increments are approximately equal visible travel distance.

### Heading

Vehicle heading comes from the local path tangent, not from an angular step toward the next polyline segment.

For a cubic connector:

```text
heading = atan2(dX/dt, dZ/dt)
```

using the cubic derivative at the sampled `t`.

This replaces the PR3 behavior where a curve is visually approximated by a few line headings plus heading blending.

The transform pipeline becomes:

```text
visual distance
      ↓
sample prepared path
      ↓
position + analytic/local tangent
      ↓
vehicle position + rotation
```

No independent steering simulation is required in v1. Smooth steering is achieved by continuous path tangent and C1 connector geometry.

## Presentation kinematics

### State

Drive agents maintain presentation-only motion state:

```ts
interface VehicleKinematicsState {
  visualDistanceMillimeters: number;
  visualSpeedMillimetersPerSecond: number;
  canonicalTargetDistanceMillimeters: number;
  lastFrameTimestampMs: number;
}
```

This state is runtime-only and keyed by the existing presentation identity (`tripId` until Vehicle Life later changes the key to `vehicleId`).

Pedestrian motion is not redesigned in PR3.1.

### Canonical target

Each Traffic reconciliation updates `canonicalTargetDistanceMillimeters` using the existing PR3 source-edge span projection.

Normal visible motion must satisfy:

```text
visualDistance <= canonicalTargetDistance
```

A visible vehicle must not run ahead of committed Traffic authority.

### Desired speed

Desired visual speed is derived from:

1. canonical distance still available to follow;
2. time since the previous committed Traffic target;
3. queue state;
4. current/upcoming movement kind;
5. a bounded catch-up multiplier.

PR3.1 does **not** use visual desired speed to alter canonical Traffic arrival time.

### Acceleration/deceleration policy

Use a centrally defined immutable presentation policy rather than magic numbers in `TrafficPresentation`.

Recommended baseline:

```ts
export interface VehicleMotionPresentationPolicy {
  readonly accelerationResponseSeconds: 0.45;
  readonly decelerationResponseSeconds: 0.30;
  readonly turnSpeedFactor: 0.55;
  readonly turnApproachCellFraction: 0.35;
  readonly maxCatchupSpeedMultiplier: 1.5;
  readonly stopSpeedEpsilonMillimetersPerSecond: number;
}
```

The concrete epsilon is derived from presentation route scale and locked by tests.

Interpretation:

- acceleration responds more slowly than an instantaneous speed assignment;
- braking may respond slightly faster than acceleration;
- left and right turns share the same visual turn-speed factor in v1;
- PR3.1 does not claim physical km/h acceleration accuracy;
- policy values tune visual realism only.

Velocity changes are bounded per frame using elapsed real time. Frame-rate differences must not materially change the sampled position for the same timestamp sequence.

### Turn-speed envelope

A vehicle starts reducing desired visual speed before entering a `turn-left` or `turn-right` segment.

The approach distance is derived from the gameplay Road-cell presentation length:

```text
turnApproachDistance = cellPresentationLength × 0.35
```

Inside the curve, desired visual speed is capped by:

```text
straightDesiredSpeed × 0.55
```

After leaving the curve, normal acceleration resumes.

This is presentation-only. Local/Collector/Arterial canonical Traffic speed/capacity profiles from PR3 are unchanged.

### Queue behavior

When canonical `queued === true`:

- desired visual speed becomes zero;
- the car decelerates toward the current canonical target;
- the visual may not cross beyond the target merely to preserve momentum;
- when the queue releases, the car accelerates again using the same policy.

### Bounded lag and recovery

Smoothing is allowed to create visual lag behind canonical progress. It must remain bounded.

Normal visible recovery uses a catch-up multiplier no greater than `1.5×` the presentation follower's baseline speed.

A visible vehicle must not snap merely because one snapshot was delayed. Hard re-anchoring is permitted only for lifecycle boundaries where continuity cannot be preserved, such as first materialization after being off-screen or an invalidated route with no safe geometric correspondence.

Road upgrade reconciliation from PR3 must continue to preserve the canonical trip and re-prepare geometry without creating a replacement logical trip.

## Journey replay integration

Short trips that complete within one logical tick still use journey replay.

Drive journey replay must use the same prepared motion-path sampler as active Drive vehicles so a replay car does not reintroduce angular turns.

Replay may keep its bounded start/end duration policy, but its spatial sampling and heading must use:

```text
PreparedMotionPath
→ curve-aware position
→ tangent heading
```

PR3.1 does not change replay authority or make a replay a canonical trip.

## Curved Road lane/center markings

### Current limitation

`road-three` currently draws center-divider geometry only when a Road cell is exactly north/south or east/west. A 90-degree corner therefore has a valid Road surface and valid vehicle turn but no marking through the bend.

### Corner classification

PR3.1 adds explicit Road presentation classification for exactly two orthogonal connections:

```text
N + E
E + S
S + W
W + N
```

These are `corner` cells, distinct from:

- straight cells;
- T-junctions;
- four-way intersections;
- dead ends.

### Marking geometry

For a corner cell with `centerDividerVisible === true`, `road-three` generates a curved marking strip through the Road center using a deterministic quarter-turn curve contained inside the Road surface.

Requirements:

- marking width continues to come from `RoadStyleProfile.centerDividerWidth`;
- marking color continues to come from the Road style profile;
- marking elevation continues to use the existing marking surface offset;
- the curve remains inside the Road carriageway;
- no z-fighting with the Road surface;
- curve tessellation is deterministic;
- adjacent straight-to-corner marking endpoints meet without a visible gap.

### Junction interiors

T-junction and four-way interiors remain intentionally unmarked in PR3.1. Traffic-signal stop lines, guide lines, arrows, and junction-control markings belong to the later Traffic Control slice.

This avoids drawing decorative lane lines that imply signal/priority semantics which do not yet exist.

## Road/Traffic geometry relationship

Road markings and vehicle lane paths are related but do not share authority:

```text
Road definition + connectivity
  ├─ road-three → Road surface + center/corner marking
  └─ Traffic projection → DirectedLanePath → vehicle motion path
```

Both derive from the same canonical Road connectivity, but neither imports or mutates the other's Three.js geometry.

A center/corner marking is not a vehicle route. A vehicle route is not Road presentation authority.

## Performance contract

PR3.1 must not solve smoothness by moving expensive geometry work into RAF.

Per-frame Drive work may include:

- elapsed-time kinematics update;
- current prepared-path distance sample;
- position/tangent output;
- existing transform update.

Per-frame Drive work must not include:

- Traffic graph rebuild;
- Road projection rebuild;
- Bézier control reconstruction;
- arc-length lookup-table rebuild;
- Road marking mesh rebuild;
- global trip scan beyond existing materialized-agent work.

Prepared curve data is rebuilt only when the presentation route changes or an existing route is re-prepared under the PR3 reconciliation rules.

The deferred world-tick/Traffic-topology caching issue discovered during PR2/PR3 remains outside PR3.1.

## Determinism and frame-rate behavior

Canonical determinism remains unchanged because PR3.1 does not mutate canonical state.

Presentation tests must prove that equivalent elapsed-time sequences at common frame rates produce materially equivalent position/heading results within a small visual tolerance.

Required comparison set:

```text
30 FPS
60 FPS
120 FPS
```

The implementation must use elapsed seconds from timestamps rather than fixed per-frame acceleration increments.

## Failure and edge behavior

- Empty route remains invalid for prepared Drive motion.
- U-turn generation remains unsupported.
- Disconnected canonical route remains a closed failure.
- A zero-length curve/line segment fails during preparation rather than producing NaN transforms.
- Invalid motion-policy values fail closed during policy creation.
- If a curve cannot be safely generated inside the existing junction envelope, route preparation fails rather than silently falling back to a visibly wrong cross-road shortcut.
- A Road corner marking that cannot be generated from a valid two-orthogonal-connection cell returns empty geometry rather than drawing outside the Road.

## Testing strategy

### `traffic-three`

Focused RED/GREEN tests must prove:

- cubic connector endpoints equal lane endpoints;
- connector start/end tangents match incoming/outgoing lane headings;
- curve sampling stays inside the junction envelope;
- curve arc-length sampling is monotonic;
- heading changes continuously through a 90-degree turn;
- no instantaneous 45/90-degree heading jump occurs at connector boundaries;
- identical curve input produces identical prepared lookup data;
- U-turn rejection remains intact.

### Game Traffic presentation

Focused tests must prove:

- visual distance never exceeds canonical target;
- acceleration is progressive after start/release;
- queued state decelerates to zero rather than instant-stop transform jumps;
- turn approach lowers desired speed before connector entry;
- speed inside turn is below equivalent straight motion;
- exiting a turn resumes acceleration;
- route upgrade/reprepare preserves trip identity and continuous safe motion;
- active and journey-replay Drive visuals share the curve-aware sampler;
- elapsed-time results are stable across 30/60/120 FPS sample schedules.

### `road-three`

Focused tests must prove:

- each of the four orthogonal corner masks produces non-empty curved marking geometry when the Road style enables the divider;
- geometry remains within the Road surface width;
- straight marking behavior is unchanged;
- T and four-way junction interiors remain unmarked;
- Local/Collector/Arterial style width/color rules remain data-driven.

### Browser verification

Targeted `@road|@traffic` browser verification must include:

- a visible L-corner with curved marking;
- a Drive vehicle approaching, turning, and exiting that corner;
- trace evidence sampled across multiple animation frames showing continuous position and heading;
- queue/release scenario showing visual deceleration/acceleration;
- 1× and 4× presentation smoke with no canonical Traffic divergence;
- canonical 414×896 visual evidence for owner acceptance.

A screenshot alone is insufficient to prove motion smoothness; browser tests must retain numeric motion-trace assertions in addition to visual evidence.

## Delivery boundary

PR3.1 includes only:

- cubic/curve-aware turn trajectory preparation;
- curve-aware route position/tangent sampling;
- presentation-only vehicle acceleration/deceleration follower;
- visual turn-speed reduction;
- continuous vehicle heading from route tangent;
- curved center/lane marking geometry for simple 90-degree Road corners;
- focused unit/browser/performance-regression evidence;
- living-document updates for Roads and Traffic.

## Explicit non-goals

Not in PR3.1:

- Traffic signals, signal phases, stop signs, roundabouts;
- stop lines or signal-control junction markings;
- roadside/street-light props;
- Vehicle Life identity/ownership;
- persistent parking or pull-in/pull-out lifecycle;
- parking search/capacity;
- canonical acceleration or microscopic car-following;
- collision avoidance, lane changing, overtaking;
- one-way roads;
- multi-cell four/six-lane avenues;
- changing Local/Collector/Arterial canonical speed/capacity values;
- world-tick or Traffic-topology caching optimization.

## Release gate

PR3.1 is releasable only when all of the following are true:

- focused `traffic-three` curve/heading tests PASS;
- focused Game kinematics tests PASS;
- focused `road-three` corner-marking tests PASS;
- `pnpm check` PASS on exact head;
- targeted Browser `@road|@traffic` PASS;
- clean-worktree verification PASS;
- Sonar Quality Gate PASS;
- no Browser Policy Level-4 escalation trigger remains unresolved;
- owner 414×896 visual/manual acceptance confirms the vehicle visibly brakes into a curve, turns continuously, accelerates out, and the Road corner marking reads correctly.

## Follow-up dependency

After PR3.1 merges, the existing approved Road Lane & Vehicle Life Realism v1 roadmap continues unchanged:

```text
PR4 Vehicle Life Authority
→ PR5 Mobility Assignment + WorldSaveV8
→ PR6 Persistent Parking & Vehicle Presentation
→ PR7 release verification
```

Traffic Control & Street Lighting remains a separate post-v1/follow-up design because it introduces intersection-control semantics rather than presentation-only realism.
