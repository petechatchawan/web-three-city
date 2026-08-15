import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  TrafficPedestrianPool,
  TrafficSpatialIndex,
  TrafficVehiclePool,
  deriveVehicleVisualPlacements,
  selectTrafficAgentsForMaterialization,
  type TrafficPresentationPolicy,
} from '@web-three-city/traffic-three';
import type { Scene } from 'three';
import {
  EMPTY_TRAFFIC_PRESENTATION_DEBUG,
  type TrafficPresentationDebugSnapshot,
} from './traffic-presentation-debug.js';
import type {
  TrafficPresentationAgent,
  TrafficPresentationSnapshot,
} from './traffic-presentation-projection.js';

export interface TrafficPresentationCameraQuery {
  readonly x: number;
  readonly z: number;
}

function edgeLengthMillimeters(agent: TrafficPresentationAgent): number {
  const dx = agent.to.xQ - agent.from.xQ;
  const dy = agent.to.yQ - agent.from.yQ;
  const dz = agent.to.zQ - agent.from.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

export class TrafficPresentation {
  readonly #pedestrians = new TrafficPedestrianPool();
  readonly #vehicles = new TrafficVehiclePool();
  readonly #policy: TrafficPresentationPolicy;
  #lastTrafficRevision = -1;
  #spatialIndex: TrafficSpatialIndex<TrafficPresentationAgent> | null = null;
  #debug: TrafficPresentationDebugSnapshot = EMPTY_TRAFFIC_PRESENTATION_DEBUG;

  constructor(scene: Scene, policy: TrafficPresentationPolicy = FOUNDATION_TRAFFIC_PRESENTATION_POLICY) {
    this.#policy = policy;
    scene.add(this.#pedestrians.root, this.#vehicles.root);
  }

  get lastTrafficRevision(): number {
    return this.#lastTrafficRevision;
  }

  update(
    snapshot: TrafficPresentationSnapshot,
    camera: TrafficPresentationCameraQuery,
    frameIndex: number,
  ): void {
    if (this.#spatialIndex === null || this.#lastTrafficRevision !== snapshot.trafficRevision) {
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

    for (const selected of selection.selected) {
      const agent = selected.agent;
      if (agent.mode === 'Walk') {
        retainedPedestrians.add(agent.tripId);
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
      if (!selected.updateDue && this.#vehicles.has(agent.tripId)) continue;
      const placement = vehiclePlacementByTrip.get(agent.tripId);
      const visual = this.#vehicles.acquire({
        tripId: agent.tripId,
        citizenId: agent.citizenId,
        routeEdgeId: agent.routeEdgeId,
        progressQ: placement?.adjustedProgressQ ?? agent.progressQ,
        queued: agent.queued,
        from: agent.from,
        to: agent.to,
        turn: agent.turn,
      });
      visual.object.userData.trafficLodTier = selected.tier;
    }

    this.#pedestrians.retainOnly(retainedPedestrians);
    this.#vehicles.retainOnly(retainedVehicles);
    this.#lastTrafficRevision = snapshot.trafficRevision;
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
    });
  }

  clear(): void {
    this.#pedestrians.retainOnly(new Set());
    this.#vehicles.retainOnly(new Set());
    this.#spatialIndex = null;
    this.#lastTrafficRevision = -1;
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
  }
}
