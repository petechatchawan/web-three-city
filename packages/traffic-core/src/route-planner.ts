import {
  assertTrafficId,
  compareTrafficId,
  validateTrafficGraph,
  type TrafficGraph,
  type TrafficGraphEdge,
  type TrafficMode,
} from './contracts.js';
import type { TrafficCostField } from './traffic-cost-field.js';
import { RoutingPriorityQueue } from './routing-priority.js';

export interface TransportRouteRequest {
  readonly requestTripId: string;
  readonly citizenId: string;
  readonly mode: TrafficMode;
  readonly originAccessNodeId: string;
  readonly destinationAccessNodeId: string;
}

export interface TransportRouteCandidate {
  readonly requestTripId: string;
  readonly mode: TrafficMode;
  readonly available: boolean;
  readonly generalizedCostSeconds: number | null;
  readonly routeEdgeIds: readonly string[];
}

interface BestState {
  readonly cost: number;
  readonly traversalCount: number;
  readonly previousNodeId: string | null;
  readonly incomingEdgeId: string;
}

function edgeCostSeconds(
  edge: TrafficGraphEdge,
  mode: TrafficMode,
  costField: TrafficCostField | undefined,
): number {
  if (mode !== 'Drive' || costField === undefined) return edge.freeFlowTravelSeconds;
  const travel = costField.edgeTravelSecondsById.get(edge.edgeId) ?? edge.freeFlowTravelSeconds;
  const queue = costField.queueDelaySecondsByNodeId.get(edge.toNodeId) ?? 0;
  return travel + queue;
}

function betterCandidate(
  nextCost: number,
  nextTraversals: number,
  incomingEdgeId: string,
  current: BestState | undefined,
): boolean {
  if (current === undefined) return true;
  if (nextCost !== current.cost) return nextCost < current.cost;
  if (nextTraversals !== current.traversalCount) return nextTraversals < current.traversalCount;
  return compareTrafficId(incomingEdgeId, current.incomingEdgeId) < 0;
}

export function planTransportRoute(
  graph: TrafficGraph,
  request: TransportRouteRequest,
  costField?: TrafficCostField,
): TransportRouteCandidate {
  validateTrafficGraph(graph);
  assertTrafficId(request.requestTripId);
  assertTrafficId(request.citizenId);
  assertTrafficId(request.originAccessNodeId);
  assertTrafficId(request.destinationAccessNodeId);

  const nodeIds = new Set(graph.nodes.map((node) => node.nodeId));
  if (!nodeIds.has(request.originAccessNodeId) || !nodeIds.has(request.destinationAccessNodeId)) {
    return Object.freeze({
      requestTripId: request.requestTripId,
      mode: request.mode,
      available: false,
      generalizedCostSeconds: null,
      routeEdgeIds: Object.freeze([]),
    });
  }
  if (request.originAccessNodeId === request.destinationAccessNodeId) {
    return Object.freeze({
      requestTripId: request.requestTripId,
      mode: request.mode,
      available: true,
      generalizedCostSeconds: 0,
      routeEdgeIds: Object.freeze([]),
    });
  }

  const adjacency = new Map<string, TrafficGraphEdge[]>();
  for (const edge of graph.edges) {
    if (edge.mode !== request.mode) continue;
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push(edge);
    adjacency.set(edge.fromNodeId, list);
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => compareTrafficId(a.edgeId, b.edgeId));
  }

  const best = new Map<string, BestState>();
  best.set(request.originAccessNodeId, {
    cost: 0,
    traversalCount: 0,
    previousNodeId: null,
    incomingEdgeId: '',
  });
  const queue = new RoutingPriorityQueue();
  queue.push({
    nodeId: request.originAccessNodeId,
    totalCostSeconds: 0,
    traversalCount: 0,
    incomingEdgeId: '',
  });

  while (queue.size > 0) {
    const current = queue.pop()!;
    const currentBest = best.get(current.nodeId);
    if (
      currentBest === undefined ||
      currentBest.cost !== current.totalCostSeconds ||
      currentBest.traversalCount !== current.traversalCount ||
      currentBest.incomingEdgeId !== current.incomingEdgeId
    ) {
      continue;
    }
    if (current.nodeId === request.destinationAccessNodeId) break;

    for (const edge of adjacency.get(current.nodeId) ?? []) {
      const nextCost = current.totalCostSeconds + edgeCostSeconds(edge, request.mode, costField);
      const nextTraversals = current.traversalCount + 1;
      const existing = best.get(edge.toNodeId);
      if (!betterCandidate(nextCost, nextTraversals, edge.edgeId, existing)) continue;
      best.set(edge.toNodeId, {
        cost: nextCost,
        traversalCount: nextTraversals,
        previousNodeId: current.nodeId,
        incomingEdgeId: edge.edgeId,
      });
      queue.push({
        nodeId: edge.toNodeId,
        totalCostSeconds: nextCost,
        traversalCount: nextTraversals,
        incomingEdgeId: edge.edgeId,
      });
    }
  }

  const destination = best.get(request.destinationAccessNodeId);
  if (destination === undefined) {
    return Object.freeze({
      requestTripId: request.requestTripId,
      mode: request.mode,
      available: false,
      generalizedCostSeconds: null,
      routeEdgeIds: Object.freeze([]),
    });
  }

  const route: string[] = [];
  let cursor = request.destinationAccessNodeId;
  while (cursor !== request.originAccessNodeId) {
    const state = best.get(cursor);
    if (state === undefined || state.previousNodeId === null || state.incomingEdgeId.length === 0) {
      return Object.freeze({
        requestTripId: request.requestTripId,
        mode: request.mode,
        available: false,
        generalizedCostSeconds: null,
        routeEdgeIds: Object.freeze([]),
      });
    }
    route.push(state.incomingEdgeId);
    cursor = state.previousNodeId;
  }
  route.reverse();
  return Object.freeze({
    requestTripId: request.requestTripId,
    mode: request.mode,
    available: true,
    generalizedCostSeconds: destination.cost,
    routeEdgeIds: Object.freeze(route),
  });
}

export function planModeCandidates(
  input: Readonly<{
    requestTripId: string;
    citizenId: string;
    originWalkAccessNodeId: string;
    destinationWalkAccessNodeId: string;
    originDriveAccessNodeId: string;
    destinationDriveAccessNodeId: string;
    pedestrianGraph: TrafficGraph;
    vehicleGraph: TrafficGraph;
    previousTrafficCostField?: TrafficCostField;
    driveAccessSeconds?: number;
  }>,
): readonly TransportRouteCandidate[] {
  const walk = planTransportRoute(input.pedestrianGraph, {
    requestTripId: input.requestTripId,
    citizenId: input.citizenId,
    mode: 'Walk',
    originAccessNodeId: input.originWalkAccessNodeId,
    destinationAccessNodeId: input.destinationWalkAccessNodeId,
  });
  const driveBase = planTransportRoute(
    input.vehicleGraph,
    {
      requestTripId: input.requestTripId,
      citizenId: input.citizenId,
      mode: 'Drive',
      originAccessNodeId: input.originDriveAccessNodeId,
      destinationAccessNodeId: input.destinationDriveAccessNodeId,
    },
    input.previousTrafficCostField,
  );
  const accessSeconds = input.driveAccessSeconds ?? 30;
  const drive =
    driveBase.available && driveBase.generalizedCostSeconds !== null
      ? Object.freeze({
          ...driveBase,
          generalizedCostSeconds: driveBase.generalizedCostSeconds + accessSeconds,
        })
      : driveBase;
  return Object.freeze([walk, drive]);
}
