import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  TrafficPedestrianPool,
  TrafficSpatialIndex,
  TrafficVehiclePool,
  advanceVehicleKinematics,
  createVehicleKinematicsState,
  deriveVehicleVisualPlacements,
  prepareTrafficRoute,
  samplePreparedRouteInto,
  sampleRouteEdgePosition,
  selectTrafficAgentsForMaterialization,
  setVehicleKinematicsTarget,
  type MutableTrafficRouteSample,
  type PreparedTrafficRoute,
  type TrafficPedestrianAgent,
  type TrafficPresentationPolicy,
  type TrafficVehicleAgent,
  type TrafficVisualScalePolicy,
  type VehicleKinematicsState,
} from '@web-three-city/traffic-three';
import { Vector3, type Scene } from 'three';
import {
  EMPTY_TRAFFIC_PRESENTATION_DEBUG,
  type TrafficPresentationDebugSnapshot,
} from './traffic-presentation-debug.js';
import type {
  TrafficPresentationAgent,
  TrafficPresentationSnapshot,
} from './traffic-presentation-projection.js';
import type { InspectTarget } from './ui/inspect/inspect-target.js';

export interface TrafficPresentationCameraQuery {
  readonly x: number;
  readonly z: number;
}

interface MotionState {
  readonly tripId: string;
  routeSegments: TrafficPresentationAgent['routeSegments'];
  preparedRoute: PreparedTrafficRoute;
  startDistanceMillimeters: number;
  targetDistanceMillimeters: number;
  currentDistanceMillimeters: number;
  startLateralOffsetMillimeters: number;
  targetLateralOffsetMillimeters: number;
  currentLateralOffsetMillimeters: number;
  startHeadingRadians: number;
  currentHeadingRadians: number;
  readonly position: Vector3;
  readonly sample: MutableTrafficRouteSample;
  startTimestampMs: number;
  durationMs: number;
}

interface VehicleMotionState {
  readonly tripId: string;
  routeSegments: TrafficPresentationAgent['routeSegments'];
  preparedRoute: PreparedTrafficRoute;
  readonly kinematics: VehicleKinematicsState;
  readonly position: Vector3;
  readonly sample: MutableTrafficRouteSample;
  queued: boolean;
}

interface VehicleFrameBinding {
  readonly tripId: string;
  readonly visual: TrafficVehicleAgent;
  readonly motion: VehicleMotionState;
  queued: boolean;
}

interface PedestrianFrameBinding {
  readonly tripId: string;
  readonly visual: TrafficPedestrianAgent;
  readonly motion: MotionState;
  queued: boolean;
}

interface VehicleArrivalState {
  readonly expiresAtMs: number;
  readonly visual: TrafficVehicleAgent;
  readonly motion: VehicleMotionState;
}

export interface TrafficVehicleMotionDebugView {
  readonly visualDistanceMillimeters: number;
  readonly visualSpeedMillimetersPerSecond: number;
  readonly canonicalTargetDistanceMillimeters: number;
  readonly baselineFollowerSpeedMillimetersPerSecond: number;
}

const MOTION_MIN_DURATION_MS = 80;
const MOTION_MAX_DURATION_MS = 1_000;
const ARRIVAL_PRESENTATION_DURATION_MS = 180;
const CELL_PRESENTATION_LENGTH_MILLIMETERS = 8_000;

function edgeLengthMillimeters(agent: TrafficPresentationAgent): number {
  const dx = agent.to.xQ - agent.from.xQ;
  const dy = agent.to.yQ - agent.from.yQ;
  const dz = agent.to.zQ - agent.from.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

function compareAgentIdentity(
  first: TrafficPresentationAgent,
  second: TrafficPresentationAgent,
): number {
  return first.tripId < second.tripId ? -1 : first.tripId > second.tripId ? 1 : 0;
}

function sameRoute(
  first: TrafficPresentationAgent['routeSegments'],
  second: TrafficPresentationAgent['routeSegments'],
): boolean {
  if (first.length !== second.length) return false;
  for (let index = 0; index < first.length; index += 1) {
    if (first[index]!.edgeId !== second[index]!.edgeId) return false;
  }
  return true;
}

function interpolateAngle(first: number, second: number, progress: number): number {
  let delta = second - first;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return first + delta * progress;
}

function applyLateralOffset(position: Vector3, heading: number, offsetMillimeters: number): void {
  const offset = offsetMillimeters / 1_000;
  position.x += Math.cos(heading) * offset;
  position.z -= Math.sin(heading) * offset;
}

function routeForAgent(agent: TrafficPresentationAgent): TrafficPresentationAgent['routeSegments'] {
  if (agent.routeSegments.length > 0) return agent.routeSegments;
  return Object.freeze([
    Object.freeze({
      edgeId: agent.routeEdgeId,
      from: agent.from,
      to: agent.to,
      lengthMillimeters: edgeLengthMillimeters(agent),
    }),
  ]);
}

function isTurningMovement(value: string | undefined): boolean {
  return value === 'turn-left' || value === 'turn-right';
}

export class TrafficPresentation {
  readonly #pedestrians: TrafficPedestrianPool;
  readonly #vehicles: TrafficVehiclePool;
  readonly #policy: TrafficPresentationPolicy;
  #lastTrafficRevision = -1;
  #lastCameraX = Number.NaN;
  #lastCameraZ = Number.NaN;
  #spatialIndex: TrafficSpatialIndex<TrafficPresentationAgent> | null = null;
  #debug: TrafficPresentationDebugSnapshot = EMPTY_TRAFFIC_PRESENTATION_DEBUG;
  #visibleAgents: readonly TrafficPresentationAgent[] = Object.freeze([]);
  readonly #vehicleMotion = new Map<string, VehicleMotionState>();
  readonly #pedestrianMotion = new Map<string, MotionState>();
  readonly #vehicleArrivals = new Map<string, VehicleArrivalState>();
  #frameVehicles: VehicleFrameBinding[] = [];
  #framePedestrians: PedestrianFrameBinding[] = [];
  #lastSnapshotTimestampMs: number | null = null;
  #reconciliationCount = 0;
  #frameSampleCount = 0;
  #preparedRouteCount = 0;
  #lastFrameTimestampMs = -1;

  constructor(
    scene: Scene,
    policy: TrafficPresentationPolicy = FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
    visualScalePolicy: TrafficVisualScalePolicy = FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  ) {
    this.#policy = policy;
    this.#pedestrians = new TrafficPedestrianPool(visualScalePolicy);
    this.#vehicles = new TrafficVehiclePool(visualScalePolicy);
    scene.add(this.#pedestrians.root, this.#vehicles.root);
  }

  get lastTrafficRevision(): number {
    return this.#lastTrafficRevision;
  }

  visibleAgents(): readonly TrafficPresentationAgent[] {
    return this.#visibleAgents;
  }

  pickNearestAgent(x: number, z: number, maxDistance: number): InspectTarget | null {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(maxDistance)) {
      throw new RangeError('traffic-presentation:invalid-pick-query');
    }
    if (maxDistance < 0) throw new RangeError('traffic-presentation:invalid-pick-query');
    const maximumDistanceSquared = maxDistance * maxDistance;
    let nearest: TrafficPresentationAgent | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const agent of this.#visibleAgents) {
      const position = sampleRouteEdgePosition(agent.from, agent.to, agent.progressQ);
      const dx = position.x - x;
      const dz = position.z - z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared > maximumDistanceSquared) continue;
      if (
        distanceSquared < nearestDistanceSquared ||
        (distanceSquared === nearestDistanceSquared &&
          nearest !== null &&
          agent.tripId < nearest.tripId)
      ) {
        nearest = agent;
        nearestDistanceSquared = distanceSquared;
      }
    }
    if (nearest === null) return null;
    return nearest.mode === 'Drive'
      ? Object.freeze({
          kind: 'vehicle' as const,
          citizenId: nearest.citizenId,
          tripId: nearest.tripId,
        })
      : Object.freeze({
          kind: 'citizen' as const,
          citizenId: nearest.citizenId,
          tripId: nearest.tripId,
        });
  }

  reconcile(
    snapshot: TrafficPresentationSnapshot,
    camera: TrafficPresentationCameraQuery,
    frameIndex: number,
    timestampMs: number,
  ): void {
    const snapshotChanged = this.#lastTrafficRevision !== snapshot.trafficRevision;
    if (this.#spatialIndex === null || snapshotChanged) {
      this.#spatialIndex = new TrafficSpatialIndex(snapshot.agents);
    }
    const query = this.#spatialIndex.query({
      centerX: camera.x,
      centerZ: camera.z,
      radius: this.#policy.midRadiusMeters,
    });
    const selection = selectTrafficAgentsForMaterialization({
      candidates: query.candidates,
      frameIndex,
      policy: this.#policy,
    });
    const vehicleSelections = selection.selected.filter(({ agent }) => agent.mode === 'Drive');
    const vehiclePlacements = deriveVehicleVisualPlacements(
      vehicleSelections.map(({ agent }) => ({
        tripId: agent.tripId,
        edgeId: agent.routeEdgeId,
        progressQ: agent.progressQ,
        edgeLengthMillimeters: edgeLengthMillimeters(agent),
        queued: agent.queued,
      })),
      this.#policy.vehicleMinimumHeadwayMillimeters,
    );
    const vehiclePlacementByTrip = new Map(
      vehiclePlacements.map((placement) => [placement.tripId, placement] as const),
    );
    const retainedPedestrians = new Set<string>();
    const retainedVehicles = new Set<string>();
    const selectedVehicleIds = new Set<string>();
    const selectedPedestrianIds = new Set<string>();
    const activeTripIds = new Set(snapshot.agents.map((agent) => agent.tripId));
    const visibleAgents: TrafficPresentationAgent[] = [];
    const frameVehicles: VehicleFrameBinding[] = [];
    const framePedestrians: PedestrianFrameBinding[] = [];
    const targetDurationMs =
      !snapshotChanged || this.#lastSnapshotTimestampMs === null
        ? 0
        : Math.max(
            MOTION_MIN_DURATION_MS,
            Math.min(MOTION_MAX_DURATION_MS, timestampMs - this.#lastSnapshotTimestampMs),
          );
    const committedDeltaSeconds =
      snapshotChanged && this.#lastSnapshotTimestampMs !== null
        ? Math.max(0.001, (timestampMs - this.#lastSnapshotTimestampMs) / 1_000)
        : 1;

    for (const selected of selection.selected) {
      const agent = selected.agent;
      if (agent.mode === 'Walk') {
        retainedPedestrians.add(agent.tripId);
        selectedPedestrianIds.add(agent.tripId);
        visibleAgents.push(agent);
        let visual = this.#pedestrians.get(agent.tripId);
        if (visual === undefined) {
          visual = this.#pedestrians.acquire({
            tripId: agent.tripId,
            citizenId: agent.citizenId,
            routeEdgeId: agent.routeEdgeId,
            progressQ: agent.progressQ,
            queued: agent.queued,
            from: agent.from,
            to: agent.to,
          });
        }
        visual.object.userData.routeEdgeId = agent.routeEdgeId;
        visual.object.userData.trafficLodTier = selected.tier;
        visual.setVisualState(agent.queued);
        const motion = this.#reconcileMotion(
          this.#pedestrianMotion,
          agent,
          agent.routeDistanceMillimeters,
          0,
          timestampMs,
          targetDurationMs,
        );
        framePedestrians.push({ tripId: agent.tripId, visual, motion, queued: agent.queued });
        continue;
      }

      selectedVehicleIds.add(agent.tripId);
      retainedVehicles.add(agent.tripId);
      this.#vehicleArrivals.delete(agent.tripId);
      const placement = vehiclePlacementByTrip.get(agent.tripId);
      const adjustedProgressQ = placement?.adjustedProgressQ ?? agent.progressQ;
      const edgeLength = edgeLengthMillimeters(agent);
      const adjustedDistance = Math.max(
        0,
        agent.routeDistanceMillimeters +
          Math.floor(((adjustedProgressQ - agent.progressQ) * edgeLength) / 1_000_000),
      );
      const visualAgent = Object.freeze({ ...agent, progressQ: adjustedProgressQ });
      visibleAgents.push(visualAgent);
      let visual = this.#vehicles.get(agent.tripId);
      if (visual === undefined) {
        visual = this.#vehicles.acquire({
          tripId: agent.tripId,
          citizenId: agent.citizenId,
          routeEdgeId: agent.routeEdgeId,
          progressQ: adjustedProgressQ,
          queued: agent.queued,
          from: agent.from,
          to: agent.to,
          turn: agent.turn,
        });
      }
      visual.object.userData.routeEdgeId = agent.routeEdgeId;
      visual.object.userData.trafficLodTier = selected.tier;
      const motion = this.#reconcileVehicleMotion(
        agent,
        adjustedDistance,
        timestampMs,
        committedDeltaSeconds,
      );
      frameVehicles.push({ tripId: agent.tripId, visual, motion, queued: agent.queued });
    }

    for (const tripId of [...this.#pedestrianMotion.keys()]) {
      if (selectedPedestrianIds.has(tripId)) continue;
      this.#pedestrianMotion.delete(tripId);
      this.#pedestrians.release(tripId);
    }

    for (const [tripId, motion] of this.#vehicleMotion) {
      if (selectedVehicleIds.has(tripId)) continue;
      if (activeTripIds.has(tripId)) {
        this.#vehicleArrivals.delete(tripId);
        this.#vehicleMotion.delete(tripId);
        this.#vehicles.release(tripId);
        continue;
      }
      const visual = this.#vehicles.get(tripId);
      if (visual === undefined) {
        this.#vehicleMotion.delete(tripId);
        continue;
      }
      let arrival = this.#vehicleArrivals.get(tripId);
      if (arrival === undefined) {
        this.#sampleVehicleMotion(motion, timestampMs, motion.queued);
        if (
          motion.kinematics.canonicalTargetDistanceMillimeters <
          motion.preparedRoute.totalLengthMillimeters
        ) {
          setVehicleKinematicsTarget(
            motion.kinematics,
            motion.preparedRoute.totalLengthMillimeters,
            ARRIVAL_PRESENTATION_DURATION_MS / 1_000,
          );
        }
        motion.queued = false;
        arrival = { expiresAtMs: timestampMs + ARRIVAL_PRESENTATION_DURATION_MS, visual, motion };
        this.#vehicleArrivals.set(tripId, arrival);
      }
      retainedVehicles.add(tripId);
    }

    this.#pedestrians.retainOnly(retainedPedestrians);
    this.#vehicles.retainOnly(retainedVehicles);
    this.#framePedestrians = framePedestrians;
    this.#frameVehicles = frameVehicles;
    this.#visibleAgents = Object.freeze(visibleAgents.sort(compareAgentIdentity));
    this.#lastTrafficRevision = snapshot.trafficRevision;
    this.#lastCameraX = camera.x;
    this.#lastCameraZ = camera.z;
    if (snapshotChanged) this.#lastSnapshotTimestampMs = timestampMs;
    this.#reconciliationCount += 1;
    this.#debug = Object.freeze({
      trafficRevision: snapshot.trafficRevision,
      logicalActiveTrips: snapshot.agents.length,
      spatialCandidates: query.metrics.candidateTripCount,
      visiblePedestrians: this.#pedestrians.activeCount,
      visibleVehicles: this.#vehicles.activeCount,
      nearAgents: selection.nearCount,
      midAgents: selection.midCount,
      poolReuseCount: this.#pedestrians.reuseCount + this.#vehicles.reuseCount,
      visitedSpatialBuckets: query.metrics.visitedBucketCount,
      totalSpatialBuckets: query.metrics.bucketCount,
      nearUpdateCount: selection.nearUpdateCount,
      midUpdateCount: selection.midUpdateCount,
      journeyReplayCount: 0,
      journeyReplayPedestrians: 0,
      journeyReplayVehicles: 0,
      reconciliationCount: this.#reconciliationCount,
      frameSampleCount: this.#frameSampleCount,
      preparedRouteCount: this.#preparedRouteCount,
      lastFrameTimestampMs: this.#lastFrameTimestampMs,
    });
  }

  frame(timestampMs: number): void {
    for (const binding of this.#framePedestrians) {
      this.#sampleMotion(binding.motion, timestampMs);
      binding.visual.setTransform(binding.motion.position, binding.motion.currentHeadingRadians);
      binding.visual.setVisualState(binding.queued);
    }
    for (const binding of this.#frameVehicles) {
      this.#sampleVehicleMotion(binding.motion, timestampMs, binding.queued);
      binding.visual.setTransform(binding.motion.position, binding.motion.sample.headingRadians);
      const movementKind =
        binding.motion.preparedRoute.preparedSegments[binding.motion.sample.segmentIndex]?.source
          .movementKind;
      binding.visual.setVisualState(binding.queued, isTurningMovement(movementKind));
    }
    for (const [tripId, arrival] of this.#vehicleArrivals) {
      if (timestampMs >= arrival.expiresAtMs) {
        this.#vehicleArrivals.delete(tripId);
        this.#vehicleMotion.delete(tripId);
        this.#vehicles.release(tripId);
        continue;
      }
      this.#sampleVehicleMotion(arrival.motion, timestampMs, false);
      arrival.visual.setTransform(arrival.motion.position, arrival.motion.sample.headingRadians);
      const movementKind =
        arrival.motion.preparedRoute.preparedSegments[arrival.motion.sample.segmentIndex]?.source
          .movementKind;
      arrival.visual.setVisualState(false, isTurningMovement(movementKind));
    }
    this.#frameSampleCount += 1;
    this.#lastFrameTimestampMs = timestampMs;
  }

  update(
    snapshot: TrafficPresentationSnapshot,
    camera: TrafficPresentationCameraQuery,
    frameIndex: number,
    timestampMs = performance.now(),
  ): void {
    const dirty =
      this.#spatialIndex === null ||
      this.#lastTrafficRevision !== snapshot.trafficRevision ||
      this.#lastCameraX !== camera.x ||
      this.#lastCameraZ !== camera.z;
    if (dirty) this.reconcile(snapshot, camera, frameIndex, timestampMs);
    this.frame(timestampMs);
  }

  clear(): void {
    this.#pedestrians.retainOnly(new Set());
    this.#vehicles.retainOnly(new Set());
    this.#spatialIndex = null;
    this.#visibleAgents = Object.freeze([]);
    this.#lastTrafficRevision = -1;
    this.#lastCameraX = Number.NaN;
    this.#lastCameraZ = Number.NaN;
    this.#vehicleMotion.clear();
    this.#pedestrianMotion.clear();
    this.#vehicleArrivals.clear();
    this.#frameVehicles = [];
    this.#framePedestrians = [];
    this.#lastSnapshotTimestampMs = null;
    this.#reconciliationCount = 0;
    this.#frameSampleCount = 0;
    this.#preparedRouteCount = 0;
    this.#lastFrameTimestampMs = -1;
    this.#debug = EMPTY_TRAFFIC_PRESENTATION_DEBUG;
  }

  debugSnapshot(): TrafficPresentationDebugSnapshot {
    return Object.freeze({
      ...this.#debug,
      visiblePedestrians: this.#pedestrians.activeCount,
      visibleVehicles: this.#vehicles.activeCount,
      poolReuseCount: this.#pedestrians.reuseCount + this.#vehicles.reuseCount,
      reconciliationCount: this.#reconciliationCount,
      frameSampleCount: this.#frameSampleCount,
      preparedRouteCount: this.#preparedRouteCount,
      lastFrameTimestampMs: this.#lastFrameTimestampMs,
    });
  }

  debugVehicleMotion(tripId: string): TrafficVehicleMotionDebugView {
    const motion = this.#vehicleMotion.get(tripId);
    if (motion === undefined) throw new Error('traffic-presentation:missing-vehicle-motion');
    return Object.freeze({
      visualDistanceMillimeters: motion.kinematics.visualDistanceMillimeters,
      visualSpeedMillimetersPerSecond: motion.kinematics.visualSpeedMillimetersPerSecond,
      canonicalTargetDistanceMillimeters: motion.kinematics.canonicalTargetDistanceMillimeters,
      baselineFollowerSpeedMillimetersPerSecond:
        motion.kinematics.baselineFollowerSpeedMillimetersPerSecond,
    });
  }

  dispose(): void {
    this.#pedestrians.root.removeFromParent();
    this.#vehicles.root.removeFromParent();
    this.#pedestrians.dispose();
    this.#vehicles.dispose();
    this.#spatialIndex = null;
    this.#visibleAgents = Object.freeze([]);
    this.#vehicleMotion.clear();
    this.#pedestrianMotion.clear();
    this.#vehicleArrivals.clear();
    this.#frameVehicles = [];
    this.#framePedestrians = [];
  }

  #reconcileVehicleMotion(
    agent: TrafficPresentationAgent,
    targetDistanceMillimeters: number,
    timestampMs: number,
    committedDeltaSeconds: number,
  ): VehicleMotionState {
    const segments = routeForAgent(agent);
    let motion = this.#vehicleMotion.get(agent.tripId);
    if (motion === undefined) {
      motion = this.#createVehicleMotion(
        agent.tripId,
        segments,
        targetDistanceMillimeters,
        timestampMs,
        agent.queued,
      );
      this.#vehicleMotion.set(agent.tripId, motion);
      return motion;
    }

    this.#sampleVehicleMotion(motion, timestampMs, motion.queued);
    if (!sameRoute(motion.routeSegments, segments)) {
      motion.routeSegments = segments;
      motion.preparedRoute = prepareTrafficRoute(segments);
      this.#preparedRouteCount += 1;
      const routeEnd = motion.preparedRoute.totalLengthMillimeters;
      motion.kinematics.visualDistanceMillimeters = Math.min(
        motion.kinematics.visualDistanceMillimeters,
        routeEnd,
      );
      motion.kinematics.canonicalTargetDistanceMillimeters = Math.min(
        motion.kinematics.canonicalTargetDistanceMillimeters,
        routeEnd,
      );
    }

    const target = Math.max(
      0,
      Math.min(motion.preparedRoute.totalLengthMillimeters, targetDistanceMillimeters),
    );
    if (target !== motion.kinematics.canonicalTargetDistanceMillimeters) {
      setVehicleKinematicsTarget(motion.kinematics, target, Math.max(0.001, committedDeltaSeconds));
    }
    motion.queued = agent.queued;
    return motion;
  }

  #createVehicleMotion(
    tripId: string,
    segments: TrafficPresentationAgent['routeSegments'],
    targetDistanceMillimeters: number,
    timestampMs: number,
    queued: boolean,
  ): VehicleMotionState {
    const preparedRoute = prepareTrafficRoute(segments);
    this.#preparedRouteCount += 1;
    const distance = Math.max(
      0,
      Math.min(preparedRoute.totalLengthMillimeters, targetDistanceMillimeters),
    );
    const position = new Vector3();
    const sample: MutableTrafficRouteSample = { headingRadians: 0, segmentIndex: 0 };
    samplePreparedRouteInto(preparedRoute, distance, position, sample);
    return {
      tripId,
      routeSegments: segments,
      preparedRoute,
      kinematics: createVehicleKinematicsState(distance, timestampMs),
      position,
      sample,
      queued,
    };
  }

  #sampleVehicleMotion(motion: VehicleMotionState, timestampMs: number, queued: boolean): void {
    advanceVehicleKinematics(motion.kinematics, {
      timestampMs,
      queued,
      preparedRoute: motion.preparedRoute,
      cellPresentationLengthMillimeters: CELL_PRESENTATION_LENGTH_MILLIMETERS,
    });
    samplePreparedRouteInto(
      motion.preparedRoute,
      motion.kinematics.visualDistanceMillimeters,
      motion.position,
      motion.sample,
    );
  }

  #reconcileMotion(
    store: Map<string, MotionState>,
    agent: TrafficPresentationAgent,
    targetDistanceMillimeters: number,
    targetLateralOffsetMillimeters: number,
    timestampMs: number,
    durationMs: number,
  ): MotionState {
    const segments = routeForAgent(agent);
    let motion = store.get(agent.tripId);
    if (motion === undefined) {
      motion = this.#createMotion(
        agent.tripId,
        segments,
        targetDistanceMillimeters,
        targetLateralOffsetMillimeters,
        timestampMs,
      );
      store.set(agent.tripId, motion);
      return motion;
    }
    this.#sampleMotion(motion, timestampMs);
    if (!sameRoute(motion.routeSegments, segments)) {
      motion.routeSegments = segments;
      motion.preparedRoute = prepareTrafficRoute(segments);
      this.#preparedRouteCount += 1;
      motion.currentDistanceMillimeters = Math.min(
        motion.currentDistanceMillimeters,
        motion.preparedRoute.totalLengthMillimeters,
      );
    }
    motion.startDistanceMillimeters = motion.currentDistanceMillimeters;
    motion.targetDistanceMillimeters = Math.max(
      0,
      Math.min(motion.preparedRoute.totalLengthMillimeters, targetDistanceMillimeters),
    );
    motion.startLateralOffsetMillimeters = motion.currentLateralOffsetMillimeters;
    motion.targetLateralOffsetMillimeters = targetLateralOffsetMillimeters;
    motion.startHeadingRadians = motion.currentHeadingRadians;
    motion.startTimestampMs = timestampMs;
    motion.durationMs = durationMs;
    return motion;
  }

  #createMotion(
    tripId: string,
    segments: TrafficPresentationAgent['routeSegments'],
    targetDistanceMillimeters: number,
    targetLateralOffsetMillimeters: number,
    timestampMs: number,
  ): MotionState {
    const preparedRoute = prepareTrafficRoute(segments);
    this.#preparedRouteCount += 1;
    const position = new Vector3();
    const sample: MutableTrafficRouteSample = { headingRadians: 0, segmentIndex: 0 };
    const distance = Math.max(
      0,
      Math.min(preparedRoute.totalLengthMillimeters, targetDistanceMillimeters),
    );
    samplePreparedRouteInto(preparedRoute, distance, position, sample);
    applyLateralOffset(position, sample.headingRadians, targetLateralOffsetMillimeters);
    return {
      tripId,
      routeSegments: segments,
      preparedRoute,
      startDistanceMillimeters: distance,
      targetDistanceMillimeters: distance,
      currentDistanceMillimeters: distance,
      startLateralOffsetMillimeters: targetLateralOffsetMillimeters,
      targetLateralOffsetMillimeters,
      currentLateralOffsetMillimeters: targetLateralOffsetMillimeters,
      startHeadingRadians: sample.headingRadians,
      currentHeadingRadians: sample.headingRadians,
      position,
      sample,
      startTimestampMs: timestampMs,
      durationMs: 0,
    };
  }

  #sampleMotion(motion: MotionState, timestampMs: number): void {
    const progress =
      motion.durationMs <= 0
        ? 1
        : Math.max(0, Math.min(1, (timestampMs - motion.startTimestampMs) / motion.durationMs));
    motion.currentDistanceMillimeters =
      motion.startDistanceMillimeters +
      (motion.targetDistanceMillimeters - motion.startDistanceMillimeters) * progress;
    motion.currentLateralOffsetMillimeters =
      motion.startLateralOffsetMillimeters +
      (motion.targetLateralOffsetMillimeters - motion.startLateralOffsetMillimeters) * progress;
    samplePreparedRouteInto(
      motion.preparedRoute,
      motion.currentDistanceMillimeters,
      motion.position,
      motion.sample,
    );
    applyLateralOffset(
      motion.position,
      motion.sample.headingRadians,
      motion.currentLateralOffsetMillimeters,
    );
    motion.currentHeadingRadians = interpolateAngle(
      motion.startHeadingRadians,
      motion.sample.headingRadians,
      progress,
    );
  }
}
