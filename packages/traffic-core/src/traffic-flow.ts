import {
  compareTrafficId,
  type ActiveTransportTrip,
  type TrafficGraph,
  type TrafficGraphEdge,
} from './contracts.js';
import { type TrafficScaleInstrumentation } from './traffic-scale-instrumentation.js';

export interface TrafficFlowPolicyV1 {
  readonly version: 1;
  readonly congestionPenaltyMilliPerExcessLoadMilli: number;
  readonly maximumCongestionMilli: number;
}

export const FOUNDATION_TRAFFIC_FLOW_POLICY_V1: TrafficFlowPolicyV1 = Object.freeze({
  version: 1,
  congestionPenaltyMilliPerExcessLoadMilli: 1000,
  maximumCongestionMilli: 4000,
});

export interface TrafficEdgeProjection {
  readonly edgeId: string;
  readonly activeTripCount: number;
  readonly capacityUnits: number;
  readonly loadRatioMilli: number;
  readonly queueDelaySeconds: number;
  readonly effectiveTravelSeconds: number;
  readonly congestionMilli: number;
}

function queueDelayForEdge(edge: TrafficGraphEdge, trips: readonly ActiveTransportTrip[]): number {
  let total = 0;
  for (const trip of trips) {
    if (trip.status !== 'Active' || trip.mode !== 'Drive' || trip.queuedMovement === null) continue;
    if (trip.queuedMovement.fromEdgeId === edge.edgeId) {
      total += 4;
    }
  }
  return total;
}

export function projectTrafficEdgeFlow(
  edge: TrafficGraphEdge,
  trips: readonly ActiveTransportTrip[],
  policy: TrafficFlowPolicyV1 = FOUNDATION_TRAFFIC_FLOW_POLICY_V1,
): TrafficEdgeProjection {
  const activeTripCount = trips.reduce((count, trip) => {
    if (trip.status !== 'Active' || trip.mode !== edge.mode) return count;
    const currentEdgeId = trip.routeEdgeIds[trip.segmentIndex];
    return currentEdgeId === edge.edgeId ? count + 1 : count;
  }, 0);
  const loadRatioMilli = Math.floor((activeTripCount * 1000) / edge.capacityUnits);
  const excessLoadMilli = Math.max(0, loadRatioMilli - 1000);
  const congestionMilli = Math.min(
    policy.maximumCongestionMilli,
    Math.floor((excessLoadMilli * policy.congestionPenaltyMilliPerExcessLoadMilli) / 1000),
  );
  const congestionDelay = Math.ceil((edge.freeFlowTravelSeconds * congestionMilli) / 1000);
  const queueDelaySeconds = queueDelayForEdge(edge, trips);
  return Object.freeze({
    edgeId: edge.edgeId,
    activeTripCount,
    capacityUnits: edge.capacityUnits,
    loadRatioMilli,
    queueDelaySeconds,
    effectiveTravelSeconds: edge.freeFlowTravelSeconds + congestionDelay + queueDelaySeconds,
    congestionMilli,
  });
}

export function createTrafficEdgeProjections(
  input: Readonly<{
    graph: TrafficGraph;
    trips: readonly ActiveTransportTrip[];
    policy?: TrafficFlowPolicyV1;
    scaleInstrumentation?: TrafficScaleInstrumentation;
  }>,
): readonly TrafficEdgeProjection[] {
  const policy = input.policy ?? FOUNDATION_TRAFFIC_FLOW_POLICY_V1;
  const activeTripCountByModeAndEdge = new Map<string, number>();
  const queueDelaySecondsByEdge = new Map<string, number>();
  for (const trip of input.trips) {
    input.scaleInstrumentation?.recordFlowTripVisit();
    if (trip.status !== 'Active') continue;
    const currentEdgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (currentEdgeId !== undefined) {
      const key = `${trip.mode}\u0000${currentEdgeId}`;
      activeTripCountByModeAndEdge.set(key, (activeTripCountByModeAndEdge.get(key) ?? 0) + 1);
    }
    if (trip.mode === 'Drive' && trip.queuedMovement !== null) {
      const edgeId = trip.queuedMovement.fromEdgeId;
      queueDelaySecondsByEdge.set(edgeId, (queueDelaySecondsByEdge.get(edgeId) ?? 0) + 4);
    }
  }
  const projections = input.graph.edges.map((edge) => {
    input.scaleInstrumentation?.recordFlowEdgeVisit();
    const activeTripCount =
      activeTripCountByModeAndEdge.get(`${edge.mode}\u0000${edge.edgeId}`) ?? 0;
    const loadRatioMilli = Math.floor((activeTripCount * 1000) / edge.capacityUnits);
    const excessLoadMilli = Math.max(0, loadRatioMilli - 1000);
    const congestionMilli = Math.min(
      policy.maximumCongestionMilli,
      Math.floor((excessLoadMilli * policy.congestionPenaltyMilliPerExcessLoadMilli) / 1000),
    );
    const congestionDelay = Math.ceil((edge.freeFlowTravelSeconds * congestionMilli) / 1000);
    const queueDelaySeconds = queueDelaySecondsByEdge.get(edge.edgeId) ?? 0;
    return Object.freeze({
      edgeId: edge.edgeId,
      activeTripCount,
      capacityUnits: edge.capacityUnits,
      loadRatioMilli,
      queueDelaySeconds,
      effectiveTravelSeconds: edge.freeFlowTravelSeconds + congestionDelay + queueDelaySeconds,
      congestionMilli,
    });
  });
  projections.sort((a, b) => compareTrafficId(a.edgeId, b.edgeId));
  return Object.freeze(projections);
}
