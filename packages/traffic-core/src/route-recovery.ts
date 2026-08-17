import type { ActiveTransportTrip, TrafficGraph } from './contracts.js';
import type { TrafficCostField } from './traffic-cost-field.js';
import { planTransportRoute } from './route-planner.js';

export interface RouteRecoveryRequest {
  readonly tripId: string;
  readonly lastStableNodeId: string;
  readonly latestDestinationAccessNodeId: string | null;
}

export type RouteRecoveryResult =
  | Readonly<{ status: 'unchanged'; routeEdgeIds: readonly string[] }>
  | Readonly<{ status: 'recovered'; routeEdgeIds: readonly string[] }>
  | Readonly<{ status: 'failed'; reason: 'UnreachableDestination' }>;

export function remainingRouteValid(trip: ActiveTransportTrip, graph: TrafficGraph): boolean {
  if (trip.status !== 'Active') return true;
  const edgeById = new Map(graph.edges.map((edge) => [edge.edgeId, edge] as const));
  const remaining = trip.routeEdgeIds.slice(trip.segmentIndex);
  if (remaining.length === 0) return false;
  for (let index = 0; index < remaining.length; index += 1) {
    const edge = edgeById.get(remaining[index]!);
    if (edge === undefined || edge.mode !== trip.mode) return false;
    if (index > 0) {
      const previous = edgeById.get(remaining[index - 1]!)!;
      if (previous.toNodeId !== edge.fromNodeId) return false;
    }
  }
  return true;
}

export function recoverInvalidatedRoute(
  input: Readonly<{
    trip: ActiveTransportTrip;
    graph: TrafficGraph;
    request: RouteRecoveryRequest;
    previousCostField?: TrafficCostField;
  }>,
): RouteRecoveryResult {
  if (input.request.latestDestinationAccessNodeId === null) {
    return Object.freeze({ status: 'failed', reason: 'UnreachableDestination' });
  }
  if (input.request.tripId === input.trip.tripId && remainingRouteValid(input.trip, input.graph)) {
    const currentDestinationEdgeId = input.trip.routeEdgeIds.at(-1);
    const destinationEdge = input.graph.edges.find(
      (edge) => edge.edgeId === currentDestinationEdgeId,
    );
    if (destinationEdge?.toNodeId === input.request.latestDestinationAccessNodeId) {
      return Object.freeze({
        status: 'unchanged',
        routeEdgeIds: Object.freeze([...input.trip.routeEdgeIds]),
      });
    }
  }

  const candidate = planTransportRoute(
    input.graph,
    {
      requestTripId: input.trip.tripId,
      citizenId: input.trip.citizenId,
      mode: input.trip.mode,
      originAccessNodeId: input.request.lastStableNodeId,
      destinationAccessNodeId: input.request.latestDestinationAccessNodeId,
    },
    input.previousCostField,
  );
  if (!candidate.available || candidate.routeEdgeIds.length === 0) {
    return Object.freeze({ status: 'failed', reason: 'UnreachableDestination' });
  }
  return Object.freeze({
    status: 'recovered',
    routeEdgeIds: Object.freeze([...candidate.routeEdgeIds]),
  });
}

export function applyRouteRecovery(
  trip: ActiveTransportTrip,
  recovery: RouteRecoveryResult,
  graphRevision: number,
): ActiveTransportTrip {
  if (recovery.status === 'unchanged') return trip;
  if (recovery.status === 'failed') {
    return Object.freeze({
      ...trip,
      queuedMovement: null,
      status: 'Failed',
      failureReason: 'UnreachableDestination',
    });
  }
  return Object.freeze({
    ...trip,
    routeEdgeIds: recovery.routeEdgeIds,
    routeGraphRevision: graphRevision,
    segmentIndex: 0,
    progressQ: 0,
    queuedMovement: null,
  });
}
