import {
  createTrafficProjection,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceProjection,
  type TrafficEdgeProjection,
  type TrafficGraph,
  type TrafficSnapshotV1,
} from '@web-three-city/traffic-core';

export interface TrafficPresentationAgent {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
  readonly from: Readonly<{ xQ: number; yQ: number; zQ: number }>;
  readonly to: Readonly<{ xQ: number; yQ: number; zQ: number }>;
}

export interface TrafficPresentationSnapshot {
  readonly trafficRevision: number;
  readonly agents: readonly TrafficPresentationAgent[];
  readonly edges: readonly TrafficEdgeProjection[];
}

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

export function createTrafficPresentationSnapshot(input: Readonly<{
  traffic: TrafficSnapshotV1;
  roads: RoadTrafficSourceProjection;
  buildingAccess: BuildingTrafficAccessProjection;
}>): TrafficPresentationSnapshot {
  const walk = withBuildingRevision(
    derivePedestrianTrafficGraph(input.roads),
    input.buildingAccess.buildingRevision,
  );
  const drive = withBuildingRevision(
    deriveVehicleTrafficGraph(input.roads),
    input.buildingAccess.buildingRevision,
  );
  const combined: TrafficGraph = Object.freeze({
    sourceRoadRevision: input.roads.roadRevision,
    sourceBuildingRevision: input.buildingAccess.buildingRevision,
    nodes: Object.freeze([...walk.nodes, ...drive.nodes]),
    edges: Object.freeze([...walk.edges, ...drive.edges]),
  });
  const nodeById = new Map(combined.nodes.map((node) => [node.nodeId, node] as const));
  const edgeById = new Map(combined.edges.map((edge) => [edge.edgeId, edge] as const));
  const projection = createTrafficProjection({ snapshot: input.traffic, graph: combined });
  const agents = projection.agents.flatMap((agent) => {
    const edge = edgeById.get(agent.routeEdgeId);
    if (edge === undefined) return [];
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (from === undefined || to === undefined) return [];
    return [
      Object.freeze({
        ...agent,
        from: Object.freeze({ xQ: from.xQ, yQ: from.yQ, zQ: from.zQ }),
        to: Object.freeze({ xQ: to.xQ, yQ: to.yQ, zQ: to.zQ }),
      }),
    ];
  });
  return Object.freeze({
    trafficRevision: input.traffic.revision,
    agents: Object.freeze(agents),
    edges: projection.edges,
  });
}
