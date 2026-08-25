import { compareTrafficId, type TrafficGraph } from './contracts.js';
import { deriveTrafficCostField, type TrafficCostField } from './traffic-cost-field.js';
import {
  createTrafficEdgeProjections,
  type TrafficEdgeProjection,
  type TrafficFlowPolicyV1,
} from './traffic-flow.js';
import type { TrafficSnapshotV1 } from './traffic-snapshot.js';
import type { TrafficScaleInstrumentation } from './traffic-scale-instrumentation.js';

export interface TrafficAgentProjection {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
}

export interface TrafficProjection {
  readonly trafficRevision: number;
  readonly edges: readonly TrafficEdgeProjection[];
  readonly agents: readonly TrafficAgentProjection[];
  readonly nextCostField: TrafficCostField;
}

export function createTrafficProjection(
  input: Readonly<{
    snapshot: TrafficSnapshotV1;
    graph: TrafficGraph;
    flowPolicy?: TrafficFlowPolicyV1;
    scaleInstrumentation?: TrafficScaleInstrumentation;
  }>,
): TrafficProjection {
  const edges = createTrafficEdgeProjections({
    graph: input.graph,
    trips: input.snapshot.activeTrips,
    ...(input.flowPolicy === undefined ? {} : { policy: input.flowPolicy }),
    ...(input.scaleInstrumentation === undefined
      ? {}
      : { scaleInstrumentation: input.scaleInstrumentation }),
  });
  const agents = input.snapshot.activeTrips
    .filter((trip) => trip.status === 'Active')
    .map((trip) =>
      Object.freeze({
        tripId: trip.tripId,
        citizenId: trip.citizenId,
        mode: trip.mode,
        routeEdgeId: trip.routeEdgeIds[trip.segmentIndex]!,
        progressQ: trip.progressQ,
        queued: trip.queuedMovement !== null,
      }),
    )
    .sort((a, b) => compareTrafficId(a.tripId, b.tripId));
  const queueDelayByNode = new Map<string, number>();
  const edgeById = new Map(input.graph.edges.map((edge) => [edge.edgeId, edge] as const));
  for (const trip of input.snapshot.activeTrips) {
    if (trip.status !== 'Active' || trip.queuedMovement === null) continue;
    const incoming = edgeById.get(trip.queuedMovement.fromEdgeId);
    if (incoming === undefined) continue;
    queueDelayByNode.set(incoming.toNodeId, (queueDelayByNode.get(incoming.toNodeId) ?? 0) + 4);
  }
  const nextCostField = deriveTrafficCostField({
    trafficRevision: input.snapshot.revision,
    edges: edges.map((edge) => ({
      edgeId: edge.edgeId,
      effectiveTravelSeconds: edge.effectiveTravelSeconds,
    })),
    nodes: [...queueDelayByNode.entries()].map(([nodeId, queueDelaySeconds]) => ({
      nodeId,
      queueDelaySeconds,
    })),
  });
  return Object.freeze({
    trafficRevision: input.snapshot.revision,
    edges,
    agents: Object.freeze(agents),
    nextCostField,
  });
}
