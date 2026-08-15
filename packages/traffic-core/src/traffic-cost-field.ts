import { assertTrafficId, assertTrafficSafeInteger, compareTrafficId } from './contracts.js';

export interface TrafficCostField {
  readonly trafficRevision: number;
  readonly edgeTravelSecondsById: ReadonlyMap<string, number>;
  readonly queueDelaySecondsByNodeId: ReadonlyMap<string, number>;
}

export interface TrafficCostEdgeInput {
  readonly edgeId: string;
  readonly effectiveTravelSeconds: number;
}

export interface TrafficCostNodeInput {
  readonly nodeId: string;
  readonly queueDelaySeconds: number;
}

export function deriveTrafficCostField(input: Readonly<{
  trafficRevision: number;
  edges: readonly TrafficCostEdgeInput[];
  nodes?: readonly TrafficCostNodeInput[];
}>): TrafficCostField {
  assertTrafficSafeInteger(input.trafficRevision);
  const edgeTravelSecondsById = new Map<string, number>();
  for (const edge of [...input.edges].sort((a, b) => compareTrafficId(a.edgeId, b.edgeId))) {
    assertTrafficId(edge.edgeId);
    assertTrafficSafeInteger(edge.effectiveTravelSeconds, 1);
    edgeTravelSecondsById.set(edge.edgeId, edge.effectiveTravelSeconds);
  }
  const queueDelaySecondsByNodeId = new Map<string, number>();
  for (const node of [...(input.nodes ?? [])].sort((a, b) => compareTrafficId(a.nodeId, b.nodeId))) {
    assertTrafficId(node.nodeId);
    assertTrafficSafeInteger(node.queueDelaySeconds);
    queueDelaySecondsByNodeId.set(node.nodeId, node.queueDelaySeconds);
  }
  return Object.freeze({
    trafficRevision: input.trafficRevision,
    edgeTravelSecondsById,
    queueDelaySecondsByNodeId,
  });
}

export function emptyTrafficCostField(trafficRevision = 0): TrafficCostField {
  return deriveTrafficCostField({ trafficRevision, edges: [], nodes: [] });
}
