import type { TrafficGraph } from './contracts.js';
import { validateTrafficGraph } from './contracts.js';
import { createTrafficSnapshot, type TrafficSnapshotV1 } from './traffic-snapshot.js';

export function fingerprintTrafficSnapshot(snapshot: TrafficSnapshotV1): string {
  const canonical = createTrafficSnapshot(snapshot);
  return JSON.stringify({
    schemaVersion: canonical.schemaVersion,
    revision: canonical.revision,
    policyVersion: canonical.policyVersion,
    graphSourceRoadRevision: canonical.graphSourceRoadRevision,
    graphSourceBuildingRevision: canonical.graphSourceBuildingRevision,
    activeTrips: canonical.activeTrips.map((trip) => [
      trip.tripId,
      trip.citizenId,
      trip.mode,
      trip.originBuildingId,
      trip.destinationBuildingId,
      trip.routeEdgeIds,
      trip.routeGraphRevision,
      trip.segmentIndex,
      trip.progressQ,
      trip.lastStableNodeId,
      trip.queuedMovement,
      trip.status,
      trip.failureReason,
    ]),
  });
}

export function fingerprintTrafficGraph(graph: TrafficGraph): string {
  validateTrafficGraph(graph);
  const nodes = [...graph.nodes].sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
  const edges = [...graph.edges].sort((a, b) => (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0));
  return JSON.stringify({
    sourceRoadRevision: graph.sourceRoadRevision,
    sourceBuildingRevision: graph.sourceBuildingRevision,
    nodes: nodes.map((node) => [node.nodeId, node.xQ, node.yQ, node.zQ]),
    edges: edges.map((edge) => [
      edge.edgeId,
      edge.fromNodeId,
      edge.toNodeId,
      edge.mode,
      edge.lengthQ,
      edge.freeFlowTravelSeconds,
      edge.capacityUnits,
    ]),
  });
}
