import {
  compareTrafficId,
  type TrafficEdgeId,
  type TrafficGraph,
  type TrafficNodeId,
} from './contracts.js';

export type DriveNodeClassificationKind =
  'SimpleContinuation' | 'Diverge' | 'Merge' | 'ConflictJunction';

export interface DriveNodeClassification {
  readonly nodeId: TrafficNodeId;
  readonly classification: DriveNodeClassificationKind;
  readonly incomingEdgeIds: readonly TrafficEdgeId[];
  readonly outgoingEdgeIds: readonly TrafficEdgeId[];
}

function sortedEdgeIds(edgeIds: readonly TrafficEdgeId[]): readonly TrafficEdgeId[] {
  return Object.freeze([...edgeIds].sort(compareTrafficId));
}

function classificationFor(
  incomingEdgeIds: readonly TrafficEdgeId[],
  outgoingEdgeIds: readonly TrafficEdgeId[],
): DriveNodeClassificationKind | null {
  if (incomingEdgeIds.length === 0 || outgoingEdgeIds.length === 0) return null;
  if (incomingEdgeIds.length === 1 && outgoingEdgeIds.length === 1) return 'SimpleContinuation';
  if (incomingEdgeIds.length === 1) return 'Diverge';
  if (outgoingEdgeIds.length === 1) return 'Merge';
  return 'ConflictJunction';
}

/**
 * Derives a traversal class from directed Drive connectivity. A node without
 * both an incoming and outgoing Drive edge has no traversable node class.
 */
export function classifyDriveNode(
  graph: TrafficGraph,
  nodeId: TrafficNodeId,
): DriveNodeClassification | null {
  const incomingEdgeIds = sortedEdgeIds(
    graph.edges
      .filter((edge) => edge.mode === 'Drive' && edge.toNodeId === nodeId)
      .map((edge) => edge.edgeId),
  );
  const outgoingEdgeIds = sortedEdgeIds(
    graph.edges
      .filter((edge) => edge.mode === 'Drive' && edge.fromNodeId === nodeId)
      .map((edge) => edge.edgeId),
  );
  const classification = classificationFor(incomingEdgeIds, outgoingEdgeIds);
  if (classification === null) return null;
  return Object.freeze({ nodeId, classification, incomingEdgeIds, outgoingEdgeIds });
}

function cacheKey(graph: TrafficGraph, nodeId: TrafficNodeId): string {
  return `${graph.sourceRoadRevision}|${graph.sourceBuildingRevision}|${nodeId}`;
}

/** Derived-only cache. A changed Traffic graph revision never shares entries. */
export class DriveNodeClassificationCache {
  readonly #cache = new Map<string, DriveNodeClassification | null>();

  get size(): number {
    return this.#cache.size;
  }

  get(graph: TrafficGraph, nodeId: TrafficNodeId): DriveNodeClassification | null | undefined {
    return this.#cache.get(cacheKey(graph, nodeId));
  }

  getOrCreate(graph: TrafficGraph, nodeId: TrafficNodeId): DriveNodeClassification | null {
    const key = cacheKey(graph, nodeId);
    if (this.#cache.has(key)) return this.#cache.get(key)!;
    const classification = classifyDriveNode(graph, nodeId);
    this.#cache.set(key, classification);
    return classification;
  }

  clear(): void {
    this.#cache.clear();
  }
}
