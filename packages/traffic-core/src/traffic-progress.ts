import {
  TRAFFIC_PROGRESS_MAX_Q,
  compareTrafficId,
  type ActiveTransportTrip,
  type TrafficGraph,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import { serviceIntersectionQueues } from './intersection-queue.js';
import type { TrafficCostField } from './traffic-cost-field.js';
import { createTrafficSnapshot, type TrafficSnapshotV1 } from './traffic-snapshot.js';

export interface TrafficProgressReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly elapsedSeconds: number;
  readonly arrivedTripIds: readonly string[];
  readonly newlyQueuedTripIds: readonly string[];
  readonly releasedTripIds: readonly string[];
}

function edgeTravelSeconds(
  edgeId: string,
  graph: TrafficGraph,
  costField?: TrafficCostField,
): number {
  const edge = graph.edges.find((candidate) => candidate.edgeId === edgeId);
  if (edge === undefined) throw new TrafficContractError('traffic:invalid-trip');
  return costField?.edgeTravelSecondsById.get(edgeId) ?? edge.freeFlowTravelSeconds;
}

function isServiceIntersection(graph: TrafficGraph, nodeId: string): boolean {
  const neighbors = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.mode !== 'Drive') continue;
    if (edge.fromNodeId === nodeId) neighbors.add(edge.toNodeId);
    if (edge.toNodeId === nodeId) neighbors.add(edge.fromNodeId);
  }
  return neighbors.size >= 3;
}

function releasedFromQueue(trip: ActiveTransportTrip, graph: TrafficGraph): ActiveTransportTrip {
  if (trip.queuedMovement === null) return trip;
  const fromEdge = graph.edges.find((edge) => edge.edgeId === trip.queuedMovement!.fromEdgeId);
  if (fromEdge === undefined) throw new TrafficContractError('traffic:invalid-trip');
  return Object.freeze({
    ...trip,
    segmentIndex: trip.segmentIndex + 1,
    progressQ: 0,
    lastStableNodeId: fromEdge.toNodeId,
    queuedMovement: null,
  });
}

function advanceOneTrip(
  input: Readonly<{
    trip: ActiveTransportTrip;
    graph: TrafficGraph;
    elapsedSeconds: number;
    intervalStartGameSecond: number;
    costField?: TrafficCostField;
  }>,
): Readonly<{
  trip: ActiveTransportTrip;
  arrived: boolean;
  newlyQueued: boolean;
}> {
  let trip = input.trip;
  if (trip.status !== 'Active' || trip.queuedMovement !== null || input.elapsedSeconds === 0) {
    return Object.freeze({ trip, arrived: false, newlyQueued: false });
  }
  const edgeById = new Map(input.graph.edges.map((edge) => [edge.edgeId, edge] as const));
  let elapsedRemaining = input.elapsedSeconds;
  let elapsedUsed = 0;
  while (elapsedRemaining > 0 && trip.status === 'Active') {
    const edgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (edgeId === undefined) throw new TrafficContractError('traffic:invalid-trip');
    const edge = edgeById.get(edgeId);
    if (edge === undefined || edge.mode !== trip.mode) {
      throw new TrafficContractError('traffic:invalid-trip');
    }
    const travelSeconds = edgeTravelSeconds(edgeId, input.graph, input.costField);
    const remainingQ = TRAFFIC_PROGRESS_MAX_Q - trip.progressQ;
    const secondsToFinish = Math.max(
      1,
      Math.ceil((travelSeconds * remainingQ) / TRAFFIC_PROGRESS_MAX_Q),
    );
    if (elapsedRemaining < secondsToFinish) {
      const progressAdded = Math.floor((elapsedRemaining * TRAFFIC_PROGRESS_MAX_Q) / travelSeconds);
      trip = Object.freeze({
        ...trip,
        progressQ: Math.min(
          TRAFFIC_PROGRESS_MAX_Q - 1,
          trip.progressQ + Math.max(1, progressAdded),
        ),
      });
      elapsedUsed += elapsedRemaining;
      elapsedRemaining = 0;
      break;
    }

    elapsedRemaining -= secondsToFinish;
    elapsedUsed += secondsToFinish;
    const nextIndex = trip.segmentIndex + 1;
    if (nextIndex >= trip.routeEdgeIds.length) {
      trip = Object.freeze({
        ...trip,
        progressQ: TRAFFIC_PROGRESS_MAX_Q,
        lastStableNodeId: edge.toNodeId,
        queuedMovement: null,
        status: 'Arrived' as const,
        failureReason: null,
      });
      return Object.freeze({ trip, arrived: true, newlyQueued: false });
    }

    const nextEdgeId = trip.routeEdgeIds[nextIndex]!;
    const nextEdge = edgeById.get(nextEdgeId);
    if (
      nextEdge === undefined ||
      nextEdge.fromNodeId !== edge.toNodeId ||
      nextEdge.mode !== trip.mode
    ) {
      throw new TrafficContractError('traffic:invalid-trip');
    }

    if (trip.mode === 'Drive' && isServiceIntersection(input.graph, edge.toNodeId)) {
      trip = Object.freeze({
        ...trip,
        progressQ: TRAFFIC_PROGRESS_MAX_Q,
        lastStableNodeId: edge.toNodeId,
        queuedMovement: Object.freeze({
          fromEdgeId: edge.edgeId,
          toEdgeId: nextEdge.edgeId,
          arrivedAtGameSecond: input.intervalStartGameSecond + elapsedUsed,
        }),
      });
      return Object.freeze({ trip, arrived: false, newlyQueued: true });
    }

    trip = Object.freeze({
      ...trip,
      segmentIndex: nextIndex,
      progressQ: 0,
      lastStableNodeId: edge.toNodeId,
    });
  }
  return Object.freeze({ trip, arrived: false, newlyQueued: false });
}

export function advanceTrafficSnapshot(
  input: Readonly<{
    snapshot: TrafficSnapshotV1;
    graph: TrafficGraph;
    elapsedSeconds: number;
    intervalStartGameSecond: number;
    costField?: TrafficCostField;
  }>,
): Readonly<{ snapshot: TrafficSnapshotV1; receipt: TrafficProgressReceipt }> {
  const snapshot = createTrafficSnapshot(input.snapshot);
  if (
    !Number.isSafeInteger(input.elapsedSeconds) ||
    input.elapsedSeconds < 0 ||
    !Number.isSafeInteger(input.intervalStartGameSecond) ||
    input.intervalStartGameSecond < 0
  ) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  if (input.elapsedSeconds === 0) {
    return Object.freeze({
      snapshot,
      receipt: Object.freeze({
        beforeRevision: snapshot.revision,
        afterRevision: snapshot.revision,
        elapsedSeconds: 0,
        arrivedTripIds: Object.freeze([]),
        newlyQueuedTripIds: Object.freeze([]),
        releasedTripIds: Object.freeze([]),
      }),
    });
  }

  const service = serviceIntersectionQueues({
    trips: snapshot.activeTrips,
    graph: input.graph,
    elapsedSeconds: input.elapsedSeconds,
  });
  const releasedSet = new Set(service.releasedTripIds);
  const arrived: string[] = [];
  const newlyQueued: string[] = [];
  const nextTrips = snapshot.activeTrips.map((original) => {
    const start = releasedSet.has(original.tripId)
      ? releasedFromQueue(original, input.graph)
      : original;
    const advanced = advanceOneTrip({
      trip: start,
      graph: input.graph,
      elapsedSeconds: input.elapsedSeconds,
      intervalStartGameSecond: input.intervalStartGameSecond,
      ...(input.costField === undefined ? {} : { costField: input.costField }),
    });
    if (advanced.arrived) arrived.push(original.tripId);
    if (advanced.newlyQueued) newlyQueued.push(original.tripId);
    return advanced.trip;
  });

  arrived.sort(compareTrafficId);
  newlyQueued.sort(compareTrafficId);
  const next = createTrafficSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    activeTrips: nextTrips,
  });
  return Object.freeze({
    snapshot: next,
    receipt: Object.freeze({
      beforeRevision: snapshot.revision,
      afterRevision: next.revision,
      elapsedSeconds: input.elapsedSeconds,
      arrivedTripIds: Object.freeze(arrived),
      newlyQueuedTripIds: Object.freeze(newlyQueued),
      releasedTripIds: service.releasedTripIds,
    }),
  });
}
