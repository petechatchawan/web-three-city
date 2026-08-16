import {
  compareTrafficId,
  type ActiveTransportTrip,
  type TrafficCardinalDirection,
  type TrafficGraph,
  type TrafficGraphEdge,
} from './contracts.js';
import {
  FOUNDATION_INTERSECTION_POLICY_V1,
  intersectionMovementPriority,
  type FoundationIntersectionPolicyV1,
} from './intersection-policy.js';

export interface IntersectionQueueServiceResult {
  readonly releasedTripIds: readonly string[];
  readonly waitingTripIds: readonly string[];
}

function directionForEdge(edge: TrafficGraphEdge, graph: TrafficGraph): TrafficCardinalDirection {
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node] as const));
  const from = nodeById.get(edge.fromNodeId)!;
  const to = nodeById.get(edge.toNodeId)!;
  const dx = to.xQ - from.xQ;
  const dz = to.zQ - from.zQ;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'E' : 'W';
  return dz >= 0 ? 'S' : 'N';
}

export function serviceIntersectionQueues(
  input: Readonly<{
    trips: readonly ActiveTransportTrip[];
    graph: TrafficGraph;
    elapsedSeconds: number;
    policy?: FoundationIntersectionPolicyV1;
  }>,
): IntersectionQueueServiceResult {
  const policy = input.policy ?? FOUNDATION_INTERSECTION_POLICY_V1;
  const edgeById = new Map(input.graph.edges.map((edge) => [edge.edgeId, edge] as const));
  const byNode = new Map<string, ActiveTransportTrip[]>();
  for (const trip of input.trips) {
    if (trip.status !== 'Active' || trip.queuedMovement === null) continue;
    const incoming = edgeById.get(trip.queuedMovement.fromEdgeId);
    if (incoming === undefined) continue;
    const list = byNode.get(incoming.toNodeId) ?? [];
    list.push(trip);
    byNode.set(incoming.toNodeId, list);
  }

  const slotsPerNode =
    input.elapsedSeconds <= 0
      ? 0
      : Math.floor(input.elapsedSeconds / policy.serviceIntervalSeconds);
  const released: string[] = [];
  const waiting: string[] = [];

  for (const nodeId of [...byNode.keys()].sort(compareTrafficId)) {
    const queue = byNode.get(nodeId)!;
    queue.sort((first, second) => {
      const firstArrival = first.queuedMovement!.arrivedAtGameSecond;
      const secondArrival = second.queuedMovement!.arrivedAtGameSecond;
      if (firstArrival !== secondArrival) return firstArrival - secondArrival;
      const firstIncoming = edgeById.get(first.queuedMovement!.fromEdgeId)!;
      const firstOutgoing = edgeById.get(first.queuedMovement!.toEdgeId)!;
      const secondIncoming = edgeById.get(second.queuedMovement!.fromEdgeId)!;
      const secondOutgoing = edgeById.get(second.queuedMovement!.toEdgeId)!;
      const firstPriority = intersectionMovementPriority(
        directionForEdge(firstIncoming, input.graph),
        directionForEdge(firstOutgoing, input.graph),
        policy,
      );
      const secondPriority = intersectionMovementPriority(
        directionForEdge(secondIncoming, input.graph),
        directionForEdge(secondOutgoing, input.graph),
        policy,
      );
      return firstPriority !== secondPriority
        ? firstPriority - secondPriority
        : compareTrafficId(first.tripId, second.tripId);
    });
    queue.forEach((trip, index) => (index < slotsPerNode ? released : waiting).push(trip.tripId));
  }

  released.sort(compareTrafficId);
  waiting.sort(compareTrafficId);
  return Object.freeze({
    releasedTripIds: Object.freeze(released),
    waitingTripIds: Object.freeze(waiting),
  });
}
