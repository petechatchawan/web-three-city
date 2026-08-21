import {
  compareTrafficId,
  type TrafficGraph,
  type TrafficGraphEdge,
  type TrafficGraphNode,
} from './contracts.js';
import {
  type DriveNodeClassification,
  type DriveNodeClassificationKind,
} from './drive-node-classification.js';
import { type TrafficScaleInstrumentation } from './traffic-scale-instrumentation.js';

export interface TrafficGraphMetadata {
  readonly edgeById: ReadonlyMap<string, TrafficGraphEdge>;
  readonly nodeById: ReadonlyMap<string, TrafficGraphNode>;
  readonly driveNodeClassificationByNodeId: ReadonlyMap<string, DriveNodeClassification | null>;
}

function classificationFor(
  incomingEdgeIds: readonly string[],
  outgoingEdgeIds: readonly string[],
): DriveNodeClassificationKind | null {
  if (incomingEdgeIds.length === 0 || outgoingEdgeIds.length === 0) return null;
  if (incomingEdgeIds.length === 1 && outgoingEdgeIds.length === 1) return 'SimpleContinuation';
  if (incomingEdgeIds.length === 1) return 'Diverge';
  if (outgoingEdgeIds.length === 1) return 'Merge';
  return 'ConflictJunction';
}

function buildTrafficGraphMetadata(graph: TrafficGraph): TrafficGraphMetadata {
  const edgeById = new Map(graph.edges.map((edge) => [edge.edgeId, edge] as const));
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node] as const));
  const incomingByNodeId = new Map<string, string[]>();
  const outgoingByNodeId = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.mode !== 'Drive') continue;
    const incoming = incomingByNodeId.get(edge.toNodeId) ?? [];
    incoming.push(edge.edgeId);
    incomingByNodeId.set(edge.toNodeId, incoming);
    const outgoing = outgoingByNodeId.get(edge.fromNodeId) ?? [];
    outgoing.push(edge.edgeId);
    outgoingByNodeId.set(edge.fromNodeId, outgoing);
  }
  const driveNodeClassificationByNodeId = new Map<string, DriveNodeClassification | null>();
  for (const nodeId of nodeById.keys()) {
    const incomingEdgeIds = [...(incomingByNodeId.get(nodeId) ?? [])].sort(compareTrafficId);
    const outgoingEdgeIds = [...(outgoingByNodeId.get(nodeId) ?? [])].sort(compareTrafficId);
    const classification = classificationFor(incomingEdgeIds, outgoingEdgeIds);
    driveNodeClassificationByNodeId.set(
      nodeId,
      classification === null
        ? null
        : Object.freeze({
            nodeId,
            classification,
            incomingEdgeIds: Object.freeze(incomingEdgeIds),
            outgoingEdgeIds: Object.freeze(outgoingEdgeIds),
          }),
    );
  }
  return Object.freeze({ edgeById, nodeById, driveNodeClassificationByNodeId });
}

function revisionKey(graph: TrafficGraph): string {
  return `${graph.sourceRoadRevision}|${graph.sourceBuildingRevision}`;
}

/** Derived metadata is valid only for the immutable source graph revision. */
export class TrafficGraphMetadataCache {
  readonly #metadataByRevision = new Map<string, TrafficGraphMetadata>();

  getOrCreate(
    graph: TrafficGraph,
    instrumentation?: TrafficScaleInstrumentation,
  ): TrafficGraphMetadata {
    const key = revisionKey(graph);
    const cached = this.#metadataByRevision.get(key);
    if (cached !== undefined) {
      instrumentation?.recordGraphMetadataReuse();
      return cached;
    }
    const metadata = buildTrafficGraphMetadata(graph);
    this.#metadataByRevision.set(key, metadata);
    instrumentation?.recordGraphMetadataBuild();
    return metadata;
  }
}
