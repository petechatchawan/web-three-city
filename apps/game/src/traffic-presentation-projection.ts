import {
  TRAFFIC_PROGRESS_MAX_Q,
  createTrafficProjection,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceProjection,
  type TrafficEdgeProjection,
  type TrafficGraph,
  type TrafficSnapshotV1,
} from '@web-three-city/traffic-core';

export interface TrafficPresentationPointQ {
  readonly xQ: number;
  readonly yQ: number;
  readonly zQ: number;
}

export interface TrafficPresentationTurn {
  readonly previous: TrafficPresentationPointQ;
  readonly corner: TrafficPresentationPointQ;
  readonly next: TrafficPresentationPointQ;
  readonly turnProgressQ: number;
}

export interface TrafficPresentationAgent {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
  readonly from: TrafficPresentationPointQ;
  readonly to: TrafficPresentationPointQ;
  readonly turn: TrafficPresentationTurn | null;
}

export interface TrafficPresentationSnapshot {
  readonly trafficRevision: number;
  readonly agents: readonly TrafficPresentationAgent[];
  readonly edges: readonly TrafficEdgeProjection[];
}

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

function point(node: Readonly<{ xQ: number; yQ: number; zQ: number }>): TrafficPresentationPointQ {
  return Object.freeze({ xQ: node.xQ, yQ: node.yQ, zQ: node.zQ });
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
  const logicalTripById = new Map(input.traffic.activeTrips.map((trip) => [trip.tripId, trip] as const));
  const projection = createTrafficProjection({ snapshot: input.traffic, graph: combined });
  const agents = projection.agents.flatMap((agent) => {
    const edge = edgeById.get(agent.routeEdgeId);
    if (edge === undefined) return [];
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (from === undefined || to === undefined) return [];
    const logicalTrip = logicalTripById.get(agent.tripId);
    let turn: TrafficPresentationTurn | null = null;
    if (
      agent.mode === 'Drive' &&
      !agent.queued &&
      agent.progressQ >= 850_000 &&
      logicalTrip !== undefined
    ) {
      const nextEdgeId = logicalTrip.routeEdgeIds[logicalTrip.segmentIndex + 1];
      const nextEdge = nextEdgeId === undefined ? undefined : edgeById.get(nextEdgeId);
      const nextNode = nextEdge === undefined ? undefined : nodeById.get(nextEdge.toNodeId);
      if (nextEdge !== undefined && nextNode !== undefined && nextEdge.fromNodeId === edge.toNodeId) {
        turn = Object.freeze({
          previous: point(from),
          corner: point(to),
          next: point(nextNode),
          turnProgressQ: Math.min(
            TRAFFIC_PROGRESS_MAX_Q,
            Math.floor(((agent.progressQ - 850_000) * TRAFFIC_PROGRESS_MAX_Q) / 150_000),
          ),
        });
      }
    }
    return [
      Object.freeze({
        ...agent,
        from: point(from),
        to: point(to),
        turn,
      }),
    ];
  });
  return Object.freeze({
    trafficRevision: input.traffic.revision,
    agents: Object.freeze(agents),
    edges: projection.edges,
  });
}
