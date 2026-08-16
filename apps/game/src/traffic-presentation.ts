import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  TrafficPedestrianPool,
  TrafficSpatialIndex,
  TrafficVehiclePool,
  deriveVehicleVisualPlacements,
  sampleRoutePolyline,
  sampleRouteEdgePosition,
  selectTrafficAgentsForMaterialization,
  type TrafficPresentationPolicy,
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

interface VehicleMotionState {
  routeSegments: TrafficPresentationAgent['routeSegments'];
  startDistanceMillimeters: number;
  targetDistanceMillimeters: number;
  currentDistanceMillimeters: number;
  startLateralOffsetMillimeters: number;
  targetLateralOffsetMillimeters: number;
  currentLateralOffsetMillimeters: number;
  startHeadingRadians: number;
  currentHeadingRadians: number;
  readonly position: Vector3;
  readonly startPosition: Vector3;
  startTimestampMs: number;
  durationMs: number;
}

interface VehicleArrivalState {
  readonly expiresAtMs: number;
  readonly motion: VehicleMotionState;
}

const MOTION_MIN_DURATION_MS = 80;
const MOTION_MAX_DURATION_MS = 1_000;
const ARRIVAL_PRESENTATION_DURATION_MS = 180;

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

function sampleVehicleTarget(
  agent: TrafficPresentationAgent,
  routeDistanceMillimeters: number,
  lateralOffsetMillimeters: number,
): Readonly<{ position: Vector3; headingRadians: number }> {
  if (agent.routeSegments.length === 0) {
    const position = sampleRouteEdgePosition(agent.from, agent.to, agent.progressQ);
    const headingRadians = Math.atan2(agent.to.xQ - agent.from.xQ, agent.to.zQ - agent.from.zQ);
    applyLateralOffset(position, headingRadians, lateralOffsetMillimeters);
    return Object.freeze({ position, headingRadians });
  }
  const sample = sampleRoutePolyline(agent.routeSegments, routeDistanceMillimeters);
  applyLateralOffset(sample.position, sample.headingRadians, lateralOffsetMillimeters);
  return Object.freeze({ position: sample.position, headingRadians: sample.headingRadians });
}

function sampleMotionRoute(
  routeSegments: TrafficPresentationAgent['routeSegments'],
  routeDistanceMillimeters: number,
  lateralOffsetMillimeters: number,
): Readonly<{ position: Vector3; headingRadians: number }> {
  const sample = sampleRoutePolyline(routeSegments, routeDistanceMillimeters);
  applyLateralOffset(sample.position, sample.headingRadians, lateralOffsetMillimeters);
  return Object.freeze({ position: sample.position, headingRadians: sample.headingRadians });
}

export class TrafficPresentation {
  readonly #pedestrians = new TrafficPedestrianPool();
  readonly #vehicles = new TrafficVehiclePool();
  readonly #policy: TrafficPresentationPolicy;
  #lastTrafficRevision = -1;
  #spatialIndex: TrafficSpatialIndex<TrafficPresentationAgent> | null = null;
  #debug: TrafficPresentationDebugSnapshot = EMPTY_TRAFFIC_PRESENTATION_DEBUG;
  #visibleAgents: readonly TrafficPresentationAgent[] = Object.freeze([]);
  #vehicleMotion = new Map<string, VehicleMotionState>();
  #vehicleArrivals = new Map<string, VehicleArrivalState>();
  #activeVehicleIds: ReadonlySet<string> = new Set();
  #lastSnapshotTimestampMs: number | null = null;

  constructor(
    scene: Scene,
    policy: TrafficPresentationPolicy = FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  ) {
    this.#policy = policy;
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

  update(
    snapshot: TrafficPresentationSnapshot,
    camera: TrafficPresentationCameraQuery,
    frameIndex: number,
    timestampMs = frameIndex * 16.667,
  ): void {
    const snapshotChanged = this.#lastTrafficRevision !== snapshot.trafficRevision;
    if (this.#spatialIndex === null || this.#lastTrafficRevision !== snapshot.trafficRevision) {
      this.#spatialIndex = new TrafficSpatialIndex(snapshot.agents);
    }
    if (snapshotChanged) {
      this.#activeVehicleIds = new Set(
        snapshot.agents.filter((agent) => agent.mode === 'Drive').map((agent) => agent.tripId),
      );
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
    const retainedPedestrians = new Set<string>();
    const retainedVehicles = new Set<string>();
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
    const visibleAgents: TrafficPresentationAgent[] = [];
    const selectedVehicleIds = new Set<string>();
    const targetDurationMs =
      !snapshotChanged || this.#lastSnapshotTimestampMs === null
        ? 0
        : Math.max(
            MOTION_MIN_DURATION_MS,
            Math.min(
              MOTION_MAX_DURATION_MS,
              Math.max(0, timestampMs - this.#lastSnapshotTimestampMs),
            ),
          );

    for (const selected of selection.selected) {
      const agent = selected.agent;
      if (agent.mode === 'Walk') {
        retainedPedestrians.add(agent.tripId);
        visibleAgents.push(agent);
        if (!selected.updateDue && this.#pedestrians.has(agent.tripId)) continue;
        const visual = this.#pedestrians.acquire({
          tripId: agent.tripId,
          citizenId: agent.citizenId,
          routeEdgeId: agent.routeEdgeId,
          progressQ: agent.progressQ,
          queued: agent.queued,
          from: agent.from,
          to: agent.to,
        });
        visual.object.userData.trafficLodTier = selected.tier;
        continue;
      }

      retainedVehicles.add(agent.tripId);
      selectedVehicleIds.add(agent.tripId);
      this.#vehicleArrivals.delete(agent.tripId);
      const placement = vehiclePlacementByTrip.get(agent.tripId);
      const visualAgent = Object.freeze({
        ...agent,
        progressQ: placement?.adjustedProgressQ ?? agent.progressQ,
      });
      visibleAgents.push(visualAgent);
      const edgeLength = edgeLengthMillimeters(agent);
      const adjustedDistance = Math.max(
        0,
        visualAgent.routeDistanceMillimeters +
          Math.floor(((visualAgent.progressQ - agent.progressQ) * edgeLength) / 1_000_000),
      );
      const placementOffset = placement?.lateralOffsetMillimeters ?? 0;
      const vehicle =
        this.#vehicles.get(agent.tripId) ??
        this.#vehicles.acquire({
          tripId: agent.tripId,
          citizenId: agent.citizenId,
          routeEdgeId: agent.routeEdgeId,
          progressQ: visualAgent.progressQ,
          queued: agent.queued,
          from: agent.from,
          to: agent.to,
          turn: agent.turn,
        });
      const motion = this.#updateVehicleMotion(
        agent,
        adjustedDistance,
        placementOffset,
        timestampMs,
        targetDurationMs,
      );
      vehicle.setTransform(motion.position, motion.headingRadians);
      vehicle.setVisualState(agent.queued, agent.turn !== null);
      vehicle.object.userData.trafficLodTier = selected.tier;
    }

    this.#pedestrians.retainOnly(retainedPedestrians);
    this.#updateVehicleArrivals(selectedVehicleIds, retainedVehicles, timestampMs);
    this.#vehicles.retainOnly(retainedVehicles);
    this.#visibleAgents = Object.freeze(visibleAgents.sort(compareAgentIdentity));
    this.#lastTrafficRevision = snapshot.trafficRevision;
    if (snapshotChanged) this.#lastSnapshotTimestampMs = timestampMs;
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
    });
  }

  clear(): void {
    this.#pedestrians.retainOnly(new Set());
    this.#vehicles.retainOnly(new Set());
    this.#spatialIndex = null;
    this.#visibleAgents = Object.freeze([]);
    this.#lastTrafficRevision = -1;
    this.#vehicleMotion.clear();
    this.#vehicleArrivals.clear();
    this.#activeVehicleIds = new Set();
    this.#lastSnapshotTimestampMs = null;
    this.#debug = EMPTY_TRAFFIC_PRESENTATION_DEBUG;
  }

  debugSnapshot(): TrafficPresentationDebugSnapshot {
    return this.#debug;
  }

  dispose(): void {
    this.#pedestrians.root.removeFromParent();
    this.#vehicles.root.removeFromParent();
    this.#pedestrians.dispose();
    this.#vehicles.dispose();
    this.#spatialIndex = null;
    this.#visibleAgents = Object.freeze([]);
    this.#vehicleMotion.clear();
    this.#vehicleArrivals.clear();
    this.#activeVehicleIds = new Set();
    this.#lastSnapshotTimestampMs = null;
  }

  #updateVehicleMotion(
    agent: TrafficPresentationAgent,
    targetDistanceMillimeters: number,
    targetLateralOffsetMillimeters: number,
    timestampMs: number,
    durationMs: number,
  ): Readonly<{ position: Vector3; headingRadians: number }> {
    let motion = this.#vehicleMotion.get(agent.tripId);
    if (motion === undefined) {
      const target = sampleVehicleTarget(
        agent,
        targetDistanceMillimeters,
        targetLateralOffsetMillimeters,
      );
      motion = {
        routeSegments: agent.routeSegments,
        startDistanceMillimeters: targetDistanceMillimeters,
        targetDistanceMillimeters,
        currentDistanceMillimeters: targetDistanceMillimeters,
        startLateralOffsetMillimeters: targetLateralOffsetMillimeters,
        targetLateralOffsetMillimeters,
        currentLateralOffsetMillimeters: targetLateralOffsetMillimeters,
        startHeadingRadians: target.headingRadians,
        currentHeadingRadians: target.headingRadians,
        position: target.position,
        startPosition: target.position.clone(),
        startTimestampMs: timestampMs,
        durationMs: 0,
      };
      this.#vehicleMotion.set(agent.tripId, motion);
    } else if (
      motion.targetDistanceMillimeters !== targetDistanceMillimeters ||
      motion.targetLateralOffsetMillimeters !== targetLateralOffsetMillimeters ||
      !sameRoute(motion.routeSegments, agent.routeSegments)
    ) {
      motion.startDistanceMillimeters = motion.currentDistanceMillimeters;
      motion.startLateralOffsetMillimeters = motion.currentLateralOffsetMillimeters;
      motion.startHeadingRadians = motion.currentHeadingRadians;
      motion.targetDistanceMillimeters = targetDistanceMillimeters;
      motion.targetLateralOffsetMillimeters = targetLateralOffsetMillimeters;
      motion.startTimestampMs = timestampMs;
      motion.durationMs = sameRoute(motion.routeSegments, agent.routeSegments)
        ? durationMs
        : MOTION_MIN_DURATION_MS;
      motion.startPosition.copy(motion.position);
      if (!sameRoute(motion.routeSegments, agent.routeSegments)) {
        motion.routeSegments = agent.routeSegments;
      }
    }

    const progress =
      motion.durationMs === 0
        ? 1
        : Math.max(0, Math.min(1, (timestampMs - motion.startTimestampMs) / motion.durationMs));
    motion.currentDistanceMillimeters =
      motion.startDistanceMillimeters +
      (motion.targetDistanceMillimeters - motion.startDistanceMillimeters) * progress;
    motion.currentLateralOffsetMillimeters =
      motion.startLateralOffsetMillimeters +
      (motion.targetLateralOffsetMillimeters - motion.startLateralOffsetMillimeters) * progress;
    const sampled = sampleVehicleTarget(
      agent,
      motion.currentDistanceMillimeters,
      motion.currentLateralOffsetMillimeters,
    );
    motion.position.copy(sampled.position);
    motion.currentHeadingRadians = interpolateAngle(
      motion.startHeadingRadians,
      sampled.headingRadians,
      progress,
    );
    return Object.freeze({
      position: motion.position,
      headingRadians: motion.currentHeadingRadians,
    });
  }

  #updateVehicleArrivals(
    selectedVehicleIds: ReadonlySet<string>,
    retainedVehicles: Set<string>,
    timestampMs: number,
  ): void {
    for (const [tripId, motion] of this.#vehicleMotion) {
      if (this.#activeVehicleIds.has(tripId) || selectedVehicleIds.has(tripId)) continue;
      let arrival = this.#vehicleArrivals.get(tripId);
      if (arrival === undefined) {
        arrival = Object.freeze({
          expiresAtMs: timestampMs + ARRIVAL_PRESENTATION_DURATION_MS,
          motion,
        });
        this.#vehicleArrivals.set(tripId, arrival);
        motion.startDistanceMillimeters = motion.currentDistanceMillimeters;
        motion.targetDistanceMillimeters = motion.routeSegments.reduce(
          (sum, segment) => sum + segment.lengthMillimeters,
          0,
        );
        motion.startTimestampMs = timestampMs;
        motion.durationMs = ARRIVAL_PRESENTATION_DURATION_MS;
      }
      if (timestampMs < arrival.expiresAtMs && this.#vehicles.has(tripId)) {
        retainedVehicles.add(tripId);
        const progress = Math.max(
          0,
          Math.min(1, (timestampMs - motion.startTimestampMs) / motion.durationMs),
        );
        motion.currentDistanceMillimeters =
          motion.startDistanceMillimeters +
          (motion.targetDistanceMillimeters - motion.startDistanceMillimeters) * progress;
        const sample = sampleMotionRoute(
          motion.routeSegments,
          motion.currentDistanceMillimeters,
          motion.currentLateralOffsetMillimeters,
        );
        this.#vehicles.get(tripId)?.setTransform(sample.position, motion.currentHeadingRadians);
      } else {
        this.#vehicleArrivals.delete(tripId);
        this.#vehicleMotion.delete(tripId);
      }
    }
  }
}
