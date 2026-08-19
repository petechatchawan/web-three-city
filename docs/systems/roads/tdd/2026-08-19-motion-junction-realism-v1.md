# Motion & Junction Realism v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR3 lane-aware vehicle motion visibly smooth through acceleration, braking, and 90-degree turns while adding curved Road corner markings, without changing canonical Traffic semantics.

**Architecture:** Canonical Traffic continues to own route/progress/queue/trip timing. `traffic-three` upgrades PR3's directed-lane connector from flattened turn polylines to deterministic cubic presentation geometry with prepared arc-length sampling, then adds a presentation-only vehicle kinematics follower. `apps/game` consumes those primitives for active vehicles and journey replay, while `road-three` independently derives curved center-divider strips from canonical Road connectivity.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Three.js 0.185.1, Playwright, GitHub Actions Browser Verification Policy v0.2.

**Spec:** `docs/systems/roads/specs/2026-08-19-motion-junction-realism-v1.md`

## Global Constraints

- Baseline is `master@377ea016a0c537f57aa2cfff27bd622e03a6b060` after PR3 Lane-aware Traffic.
- Never implement directly on `master`; implementation branch is `feat/motion-junction-realism-v1`.
- PR3.1 is presentation-only kinematics: canonical Traffic route/progress/queue/trip timing and Local/Collector/Arterial speed/capacity values do not change.
- Production Traffic handedness remains `left` and opposing Drive traffic must remain on opposite physical lane centerlines.
- Presentation may lag canonical progress, but normal visible motion must satisfy `visualDistanceMillimeters <= canonicalTargetDistanceMillimeters`.
- U-turn generation remains unsupported and disconnected/invalid route geometry fails closed.
- Pedestrian motion is not redesigned.
- No Vehicle Life, persistent parking, traffic signals, stop lines, street-light props, lane changing, one-way roads, multi-cell avenues, or Traffic-topology caching work belongs in PR3.1.
- RAF may update elapsed-time kinematics, prepared-path sampling, and transforms only; no Traffic graph/Road projection/Bezier-control/arc-table/marking-mesh rebuild may move into RAF.
- Full Browser remains escalation-only; PR3.1 owns targeted Browser tags `road traffic`.
- Every production change follows focused RED -> observed expected failure -> minimal GREEN -> focused regression -> commit.

## File Structure

### `traffic-three`

- Create `packages/traffic-three/src/cubic-motion-curve.ts` — immutable cubic curve primitive, de Casteljau split, deterministic arc-length lookup, point/tangent sampling.
- Modify `packages/traffic-three/src/intersection-lane-connector.ts` — produce two source-edge-attributed cubic connector halves instead of four straight visual connector slices.
- Modify `packages/traffic-three/src/directed-lane-path.ts` — preserve PR3 lane offsets/edge spans while carrying cubic connector metadata.
- Modify `packages/traffic-three/src/route-geometry.ts` — prepare line/cubic route segments once and sample position+tangent by distance without per-frame route construction.
- Create `packages/traffic-three/src/vehicle-motion-kinematics.ts` — validated presentation policy plus pure elapsed-time vehicle follower/turn-speed envelope.
- Modify `packages/traffic-three/src/index.ts` — export only the new public presentation primitives.
- Modify `packages/traffic-three/test/directed-lane-path.test.ts` and `packages/traffic-three/test/route-motion.test.ts` — curve continuity, arc-length, heading, kinematics, frame-rate behavior, U-turn regression.

### Game composition

- Modify `apps/game/src/traffic-presentation-projection.ts` — carry curve/movement metadata from `DirectedLanePath` into Drive presentation routes without changing canonical source-edge projection.
- Modify `apps/game/src/traffic-presentation.ts` — use vehicle kinematics state for Drive agents; keep current pedestrian interpolation path intact.
- Modify `apps/game/src/traffic-runtime-presentation.ts` — make Drive journey replay sample the same prepared curve-aware route and tangent.
- Modify `apps/game/src/traffic-presentation.test.ts`, `apps/game/src/traffic-presentation-lane-reprepare.test.ts`, and `apps/game/src/traffic-runtime-presentation.test.ts` — progressive accel/brake, turn slowdown, route reprepare identity, replay parity.

### `road-three`

- Create `packages/road-three/src/road-corner-marking-geometry.ts` — classify four orthogonal corner masks and tessellate deterministic quadratic quarter-turn marking strips.
- Modify `packages/road-three/src/lane-marking-geometry.ts` — dispatch straight vs corner vs intentionally-empty junction marking geometry.
- Modify `packages/road-three/src/index.ts` — export the corner classifier/builder needed by focused tests.
- Modify `packages/road-three/test/road-lane-presentation-v1.test.ts` — all four corners non-empty, straight unchanged, T/four-way empty, geometry bounded/data-driven.

### Browser / living docs

- Modify `browser-tests/citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts` — retain numeric multi-frame turn/queue motion trace assertions in addition to visual evidence.
- Modify the existing Road visual release spec that owns Road topology screenshots to include an L-corner marking evidence case; do not add a second redundant Road visual harness.
- Modify `docs/systems/roads/README.md` and `docs/systems/traffic/README.md` after GREEN behavior is complete.

---

### Task 1: Preserve cubic junction geometry instead of flattening turns

**Files:**
- Create: `packages/traffic-three/src/cubic-motion-curve.ts`
- Modify: `packages/traffic-three/src/intersection-lane-connector.ts`
- Modify: `packages/traffic-three/src/directed-lane-path.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Test: `packages/traffic-three/test/directed-lane-path.test.ts`

**Interfaces:**
- Consumes: existing `TrafficWorldPointQ`, PR3 incoming/outgoing lane segments, `sourceEdgeId`, `IntersectionLaneTurn`.
- Produces:

```ts
export interface TrafficCubicCurveQ {
  readonly p0: TrafficWorldPointQ;
  readonly p1: TrafficWorldPointQ;
  readonly p2: TrafficWorldPointQ;
  readonly p3: TrafficWorldPointQ;
}

export interface TrafficCubicArcLengthLookup {
  readonly tSamples: Float64Array;
  readonly cumulativeMillimeters: Float64Array;
  readonly totalLengthMillimeters: number;
}

export function splitTrafficCubicCurveHalf(
  curve: TrafficCubicCurveQ,
): readonly [TrafficCubicCurveQ, TrafficCubicCurveQ];

export function prepareTrafficCubicArcLength(
  curve: TrafficCubicCurveQ,
  sampleCount?: number,
): TrafficCubicArcLengthLookup;
```

`IntersectionLaneConnectorSegment` keeps `from`, `to`, `sourceEdgeId`, `kind: 'connector'`, and `lengthMillimeters`, and adds:

```ts
readonly curve: TrafficCubicCurveQ;
readonly movementKind: 'turn-left' | 'turn-right' | 'straight';
```

A turn connector is represented by exactly two cubic halves split at `t=0.5`; first half is attributed to the incoming canonical edge, second half to the outgoing canonical edge. Straight connectors may remain line segments and use `movementKind: 'straight'`.

- [ ] **Step 1: Write RED curve-metadata and C1 continuity assertions**

Extend the current right-turn test so it no longer accepts a connector that is merely four straight slices:

```ts
const connector = path.segments.filter((segment) => segment.kind === 'connector');
expect(connector).toHaveLength(2);
expect(connector.every((segment) => segment.curve !== undefined)).toBe(true);

const first = connector[0]!;
const last = connector[1]!;
expect(first.curve!.p0).toEqual(first.from);
expect(last.curve!.p3).toEqual(last.to);

const startDx = first.curve!.p1.xQ - first.curve!.p0.xQ;
const startDz = first.curve!.p1.zQ - first.curve!.p0.zQ;
const endDx = last.curve!.p3.xQ - last.curve!.p2.xQ;
const endDz = last.curve!.p3.zQ - last.curve!.p2.zQ;
expect(Math.atan2(startDx, startDz)).toBeCloseTo(Math.PI / 2, 4);
expect(Math.atan2(endDx, endDz)).toBeCloseTo(0, 4);
expect(first.to).toEqual(last.from);
```

Keep the current left-hand lane-offset assertions and immediate U-turn rejection unchanged.

- [ ] **Step 2: Run the focused RED test**

Run:

```bash
pnpm --filter @web-three-city/traffic-three test -- directed-lane-path.test.ts
```

Expected: FAIL because connector segments currently contain only flattened line endpoints and the current right-turn connector has four slices with no `curve` metadata.

- [ ] **Step 3: Add deterministic cubic helpers**

Implement `cubic-motion-curve.ts` with:

```ts
export function trafficCubicPoint(curve: TrafficCubicCurveQ, t: number): TrafficWorldPointQ;
export function trafficCubicTangentXZ(
  curve: TrafficCubicCurveQ,
  t: number,
): Readonly<{ x: number; z: number }>;
```

Use cubic Bernstein evaluation for points and analytic derivative for tangent. Validate `0 <= t <= 1`, finite coordinates, positive tangent magnitude, even fixed arc sample count >= 4, and reject zero-length lookup data with `traffic-three:invalid-cubic-curve`.

Implement de Casteljau half split using midpoint interpolation so the two halves meet at exactly the same integer-Q point after deterministic rounding.

- [ ] **Step 4: Change intersection connector output to two attributed cubic halves**

Keep the existing incoming/outgoing tangent control construction. Build the full cubic, split at half, then emit two connector segments:

```ts
[
  {
    edgeId: `lane-connector:${incomingId}->${outgoingId}:incoming`,
    sourceEdgeId: incomingId,
    kind: 'connector',
    movementKind: turn === 'left' ? 'turn-left' : turn === 'right' ? 'turn-right' : 'straight',
    from: firstHalf.p0,
    to: firstHalf.p3,
    curve: firstHalf,
    lengthMillimeters: prepareTrafficCubicArcLength(firstHalf, 8).totalLengthMillimeters,
  },
  {
    edgeId: `lane-connector:${incomingId}->${outgoingId}:outgoing`,
    sourceEdgeId: outgoingId,
    kind: 'connector',
    movementKind: ...,
    from: secondHalf.p0,
    to: secondHalf.p3,
    curve: secondHalf,
    lengthMillimeters: prepareTrafficCubicArcLength(secondHalf, 8).totalLengthMillimeters,
  },
]
```

Do not change canonical route IDs or PR3 lane offset/handedness rules.

- [ ] **Step 5: Re-run Traffic-three focused tests**

Run:

```bash
pnpm --filter @web-three-city/traffic-three test -- directed-lane-path.test.ts
pnpm --filter @web-three-city/traffic-three typecheck
```

Expected: PASS, including U-turn rejection and edge-span source IDs `['east', 'south']`.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/traffic-three/src/cubic-motion-curve.ts \
  packages/traffic-three/src/intersection-lane-connector.ts \
  packages/traffic-three/src/directed-lane-path.ts \
  packages/traffic-three/src/index.ts \
  packages/traffic-three/test/directed-lane-path.test.ts
git commit -m "feat(traffic): preserve cubic junction lane geometry"
```

---

### Task 2: Make prepared route sampling curve-aware with continuous tangent heading

**Files:**
- Modify: `packages/traffic-three/src/route-geometry.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Test: `packages/traffic-three/test/route-motion.test.ts`

**Interfaces:**
- Consumes: Task 1 `TrafficCubicCurveQ`, `prepareTrafficCubicArcLength`, existing `TrafficRouteSegment`.
- Produces a backward-compatible extension:

```ts
export interface TrafficRouteSegment {
  readonly edgeId: string;
  readonly from: TrafficWorldPointQ;
  readonly to: TrafficWorldPointQ;
  readonly lengthMillimeters?: number;
  readonly curve?: TrafficCubicCurveQ;
  readonly movementKind?: 'straight' | 'turn-left' | 'turn-right';
}

export interface PreparedTrafficSegment {
  readonly source: TrafficRouteSegment;
  readonly startDistanceMillimeters: number;
  readonly endDistanceMillimeters: number;
  readonly curveLookup: TrafficCubicArcLengthLookup | null;
}

export interface PreparedTrafficRoute {
  readonly segments: readonly TrafficRouteSegment[];
  readonly preparedSegments: readonly PreparedTrafficSegment[];
  readonly cumulativeEndMillimeters: Float64Array;
  readonly totalLengthMillimeters: number;
}
```

`samplePreparedRouteInto()` remains the hot-path API and returns `headingRadians` from the sampled local tangent.

- [ ] **Step 1: Write RED arc-length and heading continuity tests**

In `route-motion.test.ts`, derive an east->south lane path and prepare it. Sample at distances immediately before, inside, and after the connector:

```ts
const prepared = prepareTrafficRoute(path.segments);
const headings: number[] = [];
for (const distance of [5_400, 5_800, 6_200, 6_600, 7_000, 7_400]) {
  const position = new Vector3();
  const sample = samplePreparedRouteInto(prepared, distance, position);
  headings.push(sample.headingRadians);
}
for (let index = 1; index < headings.length; index += 1) {
  expect(Math.abs(headings[index]! - headings[index - 1]!)).toBeLessThan(Math.PI / 4);
}
```

Also assert monotonic curve lookup cumulative distances and deterministic equality from preparing the same route twice.

- [ ] **Step 2: Run RED route-motion test**

```bash
pnpm --filter @web-three-city/traffic-three test -- route-motion.test.ts
```

Expected: FAIL because `prepareTrafficRoute()` currently treats every connector as a line and `samplePreparedRouteInto()` has no cubic arc-length/tangent branch.

- [ ] **Step 3: Prepare line/cubic segments once**

During `prepareTrafficRoute()`:

```ts
const curveLookup = segment.curve === undefined
  ? null
  : prepareTrafficCubicArcLength(segment.curve, 8);
const length = curveLookup?.totalLengthMillimeters ?? routeSegmentLengthMillimeters(segment);
```

Store the lookup in `preparedSegments`; never rebuild it in `samplePreparedRouteInto()`.

- [ ] **Step 4: Sample cubic position by distance and heading by analytic tangent**

For a curve segment, binary-search `curveLookup.cumulativeMillimeters` to find the two lookup samples that bound `localDistance`, interpolate `t` between their `tSamples`, then evaluate:

```ts
const point = trafficCubicPoint(curve, t);
const tangent = trafficCubicTangentXZ(curve, t);
outPosition.set(point.xQ / 1_000, point.yQ / 1_000, point.zQ / 1_000);
heading = Math.atan2(tangent.x, tangent.z);
```

For line segments retain linear sampling. Keep the old heading blend only for adjacent line-only segments; do not blend over cubic tangent heading.

- [ ] **Step 5: Run full Traffic-three regression**

```bash
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/traffic-three typecheck
```

Expected: PASS. The existing pool/spacing/materialization tests must remain unchanged semantically.

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/traffic-three/src/route-geometry.ts \
  packages/traffic-three/src/index.ts \
  packages/traffic-three/test/route-motion.test.ts
git commit -m "feat(traffic): sample continuous turn paths"
```

---

### Task 3: Add deterministic presentation-only vehicle kinematics

**Files:**
- Create: `packages/traffic-three/src/vehicle-motion-kinematics.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Test: `packages/traffic-three/test/route-motion.test.ts`

**Interfaces:**
- Consumes: `PreparedTrafficRoute`, route segment `movementKind`, elapsed timestamps.
- Produces:

```ts
export interface VehicleMotionPresentationPolicy {
  readonly accelerationResponseSeconds: number;
  readonly decelerationResponseSeconds: number;
  readonly turnSpeedFactor: number;
  readonly turnApproachCellFraction: number;
  readonly maxCatchupSpeedMultiplier: number;
  readonly stopSpeedEpsilonMillimetersPerSecond: number;
}

export const FOUNDATION_VEHICLE_MOTION_PRESENTATION_POLICY: VehicleMotionPresentationPolicy;

export interface VehicleKinematicsState {
  visualDistanceMillimeters: number;
  visualSpeedMillimetersPerSecond: number;
  canonicalTargetDistanceMillimeters: number;
  baselineFollowerSpeedMillimetersPerSecond: number;
  lastFrameTimestampMs: number;
}

export function createVehicleKinematicsState(
  initialDistanceMillimeters: number,
  timestampMs: number,
): VehicleKinematicsState;

export function setVehicleKinematicsTarget(
  state: VehicleKinematicsState,
  targetDistanceMillimeters: number,
  committedDeltaSeconds: number,
): void;

export function advanceVehicleKinematics(
  state: VehicleKinematicsState,
  input: Readonly<{
    timestampMs: number;
    queued: boolean;
    preparedRoute: PreparedTrafficRoute;
    cellPresentationLengthMillimeters: number;
    policy?: VehicleMotionPresentationPolicy;
  }>,
): void;
```

- [ ] **Step 1: Write RED policy/acceleration/braking/turn tests**

Add tests proving:

```ts
const state = createVehicleKinematicsState(0, 0);
setVehicleKinematicsTarget(state, 8_000, 1);
advanceVehicleKinematics(state, { timestampMs: 100, queued: false, preparedRoute, cellPresentationLengthMillimeters: 8_000 });
expect(state.visualSpeedMillimetersPerSecond).toBeGreaterThan(0);
expect(state.visualSpeedMillimetersPerSecond).toBeLessThan(state.baselineFollowerSpeedMillimetersPerSecond);
expect(state.visualDistanceMillimeters).toBeLessThanOrEqual(state.canonicalTargetDistanceMillimeters);
```

For queue braking, start with non-zero speed, set `queued: true` over several frames, assert speed decreases monotonically toward epsilon/zero and distance never crosses the canonical target.

For turn slowdown, compare identical states on a straight route vs a route whose next `turn-left`/`turn-right` begins within `0.35 * cellPresentationLengthMillimeters`; assert turn route speed is lower and recovers after the turn.

- [ ] **Step 2: Run RED kinematics tests**

```bash
pnpm --filter @web-three-city/traffic-three test -- route-motion.test.ts
```

Expected: FAIL because the kinematics policy/state/functions do not exist.

- [ ] **Step 3: Implement and validate the immutable policy**

Lock baseline values:

```ts
{
  accelerationResponseSeconds: 0.45,
  decelerationResponseSeconds: 0.30,
  turnSpeedFactor: 0.55,
  turnApproachCellFraction: 0.35,
  maxCatchupSpeedMultiplier: 1.5,
  stopSpeedEpsilonMillimetersPerSecond: 10,
}
```

Validation rules:

- response seconds finite and `> 0`;
- `0 < turnSpeedFactor <= 1`;
- `0 < turnApproachCellFraction <= 1`;
- `1 <= maxCatchupSpeedMultiplier <= 2`;
- stop epsilon finite and `>= 0`.

Invalid policy creation throws `traffic-three:invalid-vehicle-motion-policy`.

- [ ] **Step 4: Implement elapsed-time velocity response**

Use exponential response so constant desired-speed evolution is stable across frame rates:

```ts
const responseSeconds = desiredSpeed < state.visualSpeedMillimetersPerSecond
  ? policy.decelerationResponseSeconds
  : policy.accelerationResponseSeconds;
const alpha = 1 - Math.exp(-deltaSeconds / responseSeconds);
state.visualSpeedMillimetersPerSecond +=
  (desiredSpeed - state.visualSpeedMillimetersPerSecond) * alpha;
```

Compute straight desired speed from `baselineFollowerSpeedMillimetersPerSecond`; use lag-proportional catch-up up to `1.5x`. Apply a linear approach factor from `1.0` down to `0.55` as the next turn approaches, `0.55` inside the turn, then return to straight desired speed after exit. `queued` forces desired speed to `0`.

Integrate distance using the trapezoid of previous/new speed and clamp to `[0, canonicalTargetDistanceMillimeters]`. If clamping reaches target, do not allow residual momentum to advance farther.

- [ ] **Step 5: Prove 30/60/120 FPS elapsed-time stability**

Run the same 2-second state transition with frame steps `1000/30`, `1000/60`, and `1000/120`. Assert final distance differs by <= `40 mm` and final speed differs by <= `40 mm/s` across schedules; all remain behind/equal canonical target.

- [ ] **Step 6: Run Traffic-three regression and commit**

```bash
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/traffic-three typecheck
git add packages/traffic-three/src/vehicle-motion-kinematics.ts \
  packages/traffic-three/src/index.ts \
  packages/traffic-three/test/route-motion.test.ts
git commit -m "feat(traffic): add smooth vehicle presentation kinematics"
```

---

### Task 4: Integrate curve-aware kinematics into active Drive vehicles and journey replay

**Files:**
- Modify: `apps/game/src/traffic-presentation-projection.ts`
- Modify: `apps/game/src/traffic-presentation.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`
- Modify: `apps/game/src/traffic-presentation.test.ts`
- Modify: `apps/game/src/traffic-presentation-lane-reprepare.test.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.test.ts`

**Interfaces:**
- Consumes: Task 2 curve-aware `TrafficRouteSegment`/`prepareTrafficRoute` and Task 3 vehicle kinematics APIs.
- Produces no new canonical state. `TrafficPresentationAgent.routeSegments` continues to carry the existing source-edge identity and adds only optional curve/movement metadata for Drive presentation.

- [ ] **Step 1: Write RED Game tests for progressive motion and canonical bound**

Extend `traffic-presentation.test.ts` so a Drive agent advancing canonical target from 4,000 to 8,000 mm does not jump to a constant linear interpolation velocity:

```ts
presentation.update(next, camera, 1, 1_000);
presentation.frame(1_100);
const x100 = vehicle.position.x;
presentation.frame(1_200);
const x200 = vehicle.position.x;
expect(x100).toBeGreaterThan(4);
expect(x200 - x100).toBeGreaterThan(0);
expect(x200).toBeLessThanOrEqual(8);
```

Use debug/test-only motion inspection already local to the class or add a read-only `debugVehicleMotion(tripId)` returning distance/speed/target so tests can assert speed increases after release and decreases while queued without deriving speed from mesh noise.

- [ ] **Step 2: Write RED turn/reprepare tests**

Use a Drive `routeSegments` path containing a `turn-right` cubic connector. Assert:

- speed begins dropping before connector start;
- speed inside connector is below equivalent straight-route speed;
- heading samples progress continuously through the turn;
- after Road Local->Arterial reprepare, `tripId` remains identical and visual distance is safely clamped/reprepared rather than creating a replacement vehicle/trip.

Run:

```bash
pnpm --filter @web-three-city/game test -- traffic-presentation.test.ts traffic-presentation-lane-reprepare.test.ts
```

Expected: FAIL because Drive currently uses the generic `MotionState` linear target-duration interpolation and independent heading interpolation.

- [ ] **Step 3: Pass curve metadata through the projection**

When mapping `directed.segments` in `traffic-presentation-projection.ts`, preserve:

```ts
curve: segment.curve,
movementKind: segment.movementKind,
```

Do not change `sourceEdgeId`, `edgeSpans`, canonical routeEdgeIds, `progressQ`, or trip identity.

- [ ] **Step 4: Split Drive motion from pedestrian interpolation**

Keep the current generic `MotionState` for Walk agents. For Drive agents store:

```ts
interface VehicleMotionState {
  routeSegments: TrafficPresentationAgent['routeSegments'];
  preparedRoute: PreparedTrafficRoute;
  readonly kinematics: VehicleKinematicsState;
  readonly position: Vector3;
  readonly sample: MutableTrafficRouteSample;
}
```

At reconciliation:

1. sample current visual state before changing target;
2. reprepare route only when `sameRoute()` is false;
3. compute committed delta seconds from snapshot timestamps;
4. call `setVehicleKinematicsTarget()` with adjusted canonical presentation distance;
5. preserve trip-bound pool identity.

At RAF:

1. call `advanceVehicleKinematics()`;
2. call `samplePreparedRouteInto()` at `visualDistanceMillimeters`;
3. set transform from sampled position+tangent heading directly;
4. do not apply independent heading interpolation for Drive vehicles.

- [ ] **Step 5: Keep PR3 headway presentation lane-owned**

Retain the existing longitudinal minimum-headway adjustment before canonical target enters the kinematics follower. Keep lateral offset `0`; PR3's physical lane geometry remains the lateral authority.

- [ ] **Step 6: Make journey replay use the same curve-aware sampler**

`TrafficRuntimePresentation` already prepares replay routes. Preserve that structure but ensure Drive replay route segments carry curve metadata and `samplePreparedRouteInto()` supplies both position and heading. Vehicle replay transform must use `replay.sample.headingRadians`; do not rebuild a separate quadratic turn in `TrafficVehicleAgent`.

- [ ] **Step 7: Run Game focused regression**

```bash
pnpm --filter @web-three-city/game test -- \
  traffic-presentation.test.ts \
  traffic-presentation-lane-reprepare.test.ts \
  traffic-runtime-presentation.test.ts \
  traffic-lane-presentation.test.ts
pnpm --filter @web-three-city/game typecheck
```

Expected: PASS; canonical snapshot inputs remain immutable and PR3 opposing-lane tests stay green.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/game/src/traffic-presentation-projection.ts \
  apps/game/src/traffic-presentation.ts \
  apps/game/src/traffic-runtime-presentation.ts \
  apps/game/src/traffic-presentation.test.ts \
  apps/game/src/traffic-presentation-lane-reprepare.test.ts \
  apps/game/src/traffic-runtime-presentation.test.ts
git commit -m "feat(game): follow lane curves with smooth vehicle motion"
```

---

### Task 5: Add curved center-divider geometry for four simple Road corners

**Files:**
- Create: `packages/road-three/src/road-corner-marking-geometry.ts`
- Modify: `packages/road-three/src/lane-marking-geometry.ts`
- Modify: `packages/road-three/src/index.ts`
- Modify: `packages/road-three/test/road-lane-presentation-v1.test.ts`

**Interfaces:**
- Consumes: `RoadCellView.connections`, Road direction bits, `RoadStyleProfile.centerDividerWidth/color/markingSurfaceOffset`, `WorldConfig`.
- Produces:

```ts
export type RoadCornerKind =
  | 'north-east'
  | 'east-south'
  | 'south-west'
  | 'west-north';

export function classifyRoadCorner(connections: number): RoadCornerKind | null;

export function buildRoadCornerLaneMarkingMesh(
  view: RoadCellView,
  config: WorldConfig,
  corner: RoadCornerKind,
): RoadMeshData;
```

- [ ] **Step 1: Write RED four-corner marking tests**

Add:

```ts
for (const mask of [
  ROAD_NORTH | ROAD_EAST,
  ROAD_EAST | ROAD_SOUTH,
  ROAD_SOUTH | ROAD_WEST,
  ROAD_WEST | ROAD_NORTH,
]) {
  const mesh = buildRoadLaneMarkingMesh(view(BASIC_ROAD_DEFINITION, mask), WORLD_CONFIG);
  expect(mesh.indices.length).toBeGreaterThan(0);
}
```

Keep existing straight tests and T/four-way empty assertions.

Also assert every generated corner vertex stays inside the cell bounds and the strip half-width does not exceed `centerDividerWidth / 2 + 1e-5` from its sampled centerline.

- [ ] **Step 2: Run Road-three RED**

```bash
pnpm --filter @web-three-city/road-three test -- road-lane-presentation-v1.test.ts
```

Expected: FAIL because `buildRoadLaneMarkingMesh()` currently returns empty geometry for all orthogonal corner masks.

- [ ] **Step 3: Classify exactly two orthogonal connections**

Implement a closed classifier. Return one of the four corner kinds only for the exact masks above. Dead-end, straight, T, four-way, zero, and invalid bit combinations return `null`.

- [ ] **Step 4: Tessellate a deterministic curved strip**

Use an 8-step quadratic Bezier center path from one connected edge midpoint to the other with the cell center as the control point. Example north->east in local world coordinates:

```ts
p0 = [centerX, cellMinZ];
p1 = [centerX, centerZ];
p2 = [cellMaxX, centerZ];
```

Rotate/map the same construction for the other three corners. At each sample derive the quadratic tangent, normalize its perpendicular, offset left/right by `centerDividerWidth / 2`, and append a two-vertex strip row. Connect adjacent rows with two triangles. Resolve Y through the existing terrain-conforming `levelAt()` rule plus Road surface/marking offsets.

Endpoints must align with the current straight marking centerline at edge midpoints. Use the existing profile color and surface offset; no hard-coded Road-type color/width.

- [ ] **Step 5: Dispatch straight/corner/junction behavior**

`buildRoadLaneMarkingMesh()` order:

```text
exact N|S or E|W -> existing straight rectangle
exact orthogonal two-bit corner -> curved strip
anything else -> empty geometry
```

Thus T/four-way interiors remain unmarked.

- [ ] **Step 6: Run Road-three full regression and commit**

```bash
pnpm --filter @web-three-city/road-three test
pnpm --filter @web-three-city/road-three typecheck
git add packages/road-three/src/road-corner-marking-geometry.ts \
  packages/road-three/src/lane-marking-geometry.ts \
  packages/road-three/src/index.ts \
  packages/road-three/test/road-lane-presentation-v1.test.ts
git commit -m "feat(roads): draw curved corner lane markings"
```

---

### Task 6: Browser motion evidence, living docs, and PR3.1 release gate

**Files:**
- Modify: `browser-tests/citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts`
- Modify: existing Road visual release spec that currently captures Road topology/mobile presentation evidence.
- Modify: `docs/systems/roads/README.md`
- Modify: `docs/systems/traffic/README.md`
- Modify test-topology metadata only if an existing repository inventory file explicitly requires a changed browser test count; this plan intentionally reuses existing test files so Game/Traffic/Road Vitest file counts do not change.

**Interfaces:**
- Consumes: completed PR3.1 active/replay motion and curved Road marking presentation.
- Produces: numeric browser trace evidence, mobile screenshots, exact-head release evidence, living handoff.

- [ ] **Step 1: Add browser numeric turn trace before visual screenshot**

In the existing Traffic commute visual release test, expose/use the existing browser Traffic debug fixture to sample one visible Drive vehicle across multiple RAF timestamps while it approaches and traverses an L-turn. Retain an array:

```ts
Array<{
  timestampMs: number;
  x: number;
  z: number;
  headingRadians: number;
  visualSpeedMillimetersPerSecond: number;
  movementKind: string;
}>
```

Assert:

- positions are continuous and non-teleporting between samples;
- heading delta per adjacent sample remains `< Math.PI / 4`;
- at least one pre-turn speed is greater than one in-turn speed;
- post-turn speed rises after leaving the connector;
- vehicle remains on the left-hand physical lane.

Then capture the 414×896 visual screenshot containing the L-corner and vehicle path.

- [ ] **Step 2: Add queue/release browser trace**

Use the existing Traffic fixture/control seam to produce a queued Drive vehicle, sample speed while queued, release it, and assert queued samples trend toward zero while released samples increase progressively. Do not assert canonical trip timing from visual speed.

- [ ] **Step 3: Extend existing Road visual evidence with an L-corner**

Build/render a simple orthogonal Road corner and assert the Road marking mesh is visible through the bend while T/four-way junction interior expectations remain unchanged. Capture one 414×896 screenshot; do not create a parallel Road screenshot harness.

- [ ] **Step 4: Run focused package/Game tests before repository-wide verification**

```bash
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/road-three test
pnpm --filter @web-three-city/game test -- \
  traffic-presentation.test.ts \
  traffic-presentation-lane-reprepare.test.ts \
  traffic-runtime-presentation.test.ts \
  traffic-lane-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run repository finalization verification**

```bash
pnpm check
```

Expected: PASS for format, lint, typecheck, test inventory/topology, affected package tests, Game tests, and builds.

- [ ] **Step 6: Update living docs before exact-head CI**

Roads README must state:

- PR3 lane-aware traffic is merged;
- simple 90-degree corner center markings are curve-aware;
- T/four-way interiors remain intentionally unmarked;
- traffic signals/street lights remain follow-up scope.

Traffic README must state:

- Drive route presentation uses prepared line/cubic paths;
- acceleration/deceleration/turn-speed are presentation-only and never canonical Traffic authority;
- visual lag is bounded behind canonical progress;
- Vehicle Life/parking and deferred Traffic topology caching remain later work.

Do not write CI run/artifact IDs into repository files after exact-head verification; put them in PR metadata/comments.

- [ ] **Step 7: Commit docs/browser gate changes**

```bash
git add browser-tests \
  docs/systems/roads/README.md \
  docs/systems/traffic/README.md
git commit -m "test: verify Motion and Junction Realism release behavior"
```

- [ ] **Step 8: Trigger exact-head PR verification with targeted ownership**

PR body must contain:

```text
Targeted browser tags: road traffic
```

Require on the exact final head:

- Lean CI PASS / `pnpm check` PASS;
- targeted Chromium `@road|@traffic` PASS;
- clean-worktree verification PASS;
- Sonar Quality Gate PASS;
- no unresolved review threads;
- Full Browser only if Browser Policy Level-4 escalation is triggered.

- [ ] **Step 9: Owner mobile visual/manual gate**

At 414×896 manually confirm all six product-acceptance items from the spec:

1. progressive acceleration from slow/stopped state;
2. visible braking before 90-degree turn;
3. continuous curved trajectory rather than angular turn;
4. body heading continuously follows curve tangent;
5. acceleration resumes after turn;
6. curved Road center/lane marking remains readable through the corner.

Keep PR Draft until explicit owner PASS. Do not begin PR4 Vehicle Life before PR3.1 is merged.

---

## Self-Review Checklist

- Spec coverage: Tasks 1-2 cover cubic geometry/arc-length/continuous tangent; Tasks 3-4 cover accel/decel/turn-speed/bounded lag/queue/replay/reprepare; Task 5 covers four corner markings and junction non-goals; Task 6 covers browser numeric evidence, docs, exact-head CI, Sonar, clean worktree, and owner gate.
- Authority check: no task mutates `traffic-core`, Road authority, Citizen Mobility, save schemas, or canonical speed/capacity values.
- Hot-path check: curve controls and arc tables are prepared outside RAF; RAF performs only kinematics update, prepared-path sample, transform.
- Scope check: signals, lights, Vehicle Life, parking, topology caching, lane changing, one-way/multi-cell roads are excluded.
- Test-file inventory check: unit tests extend existing test files; browser evidence extends existing release specs to avoid unnecessary topology count changes.
- Type consistency: `TrafficCubicCurveQ`, `TrafficCubicArcLengthLookup`, `PreparedTrafficRoute`, `VehicleKinematicsState`, and `VehicleMotionPresentationPolicy` names/signatures are consistent across tasks.
- No placeholders/TBD/TODO remain in this plan.
