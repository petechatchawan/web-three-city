import {
  assertTrafficId,
  validateActiveTransportTrip,
  type ActiveTransportTrip,
  type TrafficGraph,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import type { TransportRouteCandidate } from './route-planner.js';

export function createActiveTransportTrip(
  input: Readonly<{
    tripId: string;
    citizenId: string;
    originBuildingId: string;
    destinationBuildingId: string;
    route: TransportRouteCandidate;
    graph: TrafficGraph;
    routeGraphRevision: number;
  }>,
): ActiveTransportTrip {
  assertTrafficId(input.tripId);
  assertTrafficId(input.citizenId);
  assertTrafficId(input.originBuildingId);
  assertTrafficId(input.destinationBuildingId);
  if (
    !input.route.available ||
    input.route.routeEdgeIds.length === 0 ||
    input.route.requestTripId !== input.tripId
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  const edgeById = new Map(input.graph.edges.map((edge) => [edge.edgeId, edge] as const));
  for (const edgeId of input.route.routeEdgeIds) {
    const edge = edgeById.get(edgeId);
    if (edge === undefined || edge.mode !== input.route.mode) {
      throw new TrafficContractError('traffic:invalid-trip');
    }
  }
  for (let index = 1; index < input.route.routeEdgeIds.length; index += 1) {
    const previous = edgeById.get(input.route.routeEdgeIds[index - 1]!)!;
    const current = edgeById.get(input.route.routeEdgeIds[index]!)!;
    if (previous.toNodeId !== current.fromNodeId) {
      throw new TrafficContractError('traffic:invalid-trip');
    }
  }
  const firstEdge = edgeById.get(input.route.routeEdgeIds[0]!)!;
  const trip: ActiveTransportTrip = Object.freeze({
    tripId: input.tripId,
    citizenId: input.citizenId,
    mode: input.route.mode,
    originBuildingId: input.originBuildingId,
    destinationBuildingId: input.destinationBuildingId,
    routeEdgeIds: Object.freeze([...input.route.routeEdgeIds]),
    routeGraphRevision: input.routeGraphRevision,
    segmentIndex: 0,
    progressQ: 0,
    lastStableNodeId: firstEdge.fromNodeId,
    queuedMovement: null,
    status: 'Active',
    failureReason: null,
  });
  validateActiveTransportTrip(trip);
  return trip;
}

export function failTransportTrip(
  trip: ActiveTransportTrip,
  reason: 'UnreachableDestination' = 'UnreachableDestination',
): ActiveTransportTrip {
  return Object.freeze({
    ...trip,
    queuedMovement: null,
    status: 'Failed',
    failureReason: reason,
  });
}

export function cancelTransportTrip(trip: ActiveTransportTrip): ActiveTransportTrip {
  return Object.freeze({
    ...trip,
    queuedMovement: null,
    status: 'Cancelled',
    failureReason: null,
  });
}
