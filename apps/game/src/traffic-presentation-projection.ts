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
import { WORLD_CONFIG } from '@web-three-city/world-core';

const TRAFFIC_Q_PER_METER = 1_000;
const TRAFFIC_CELL_METERS = 8;
const RENDER_Q_PER_UNIT = 1_000;
const WORLD_HALF_X_Q = (WORLD_CONFIG.mapWidth * WORLD_CONFIG.cellSize * RENDER_Q_PER_UNIT) / 2;
const WORLD_HALF_Z_Q = (WORLD_CONFIG.mapHeight * WORLD_CONFIG.cellSize * RENDER_Q_PER_UNIT) / 2;

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

export interface TrafficPresentationRouteSegment {
  readonly edgeId: string;
  readonly from: TrafficPresentationPointQ;
  readonly to: TrafficPresentationPointQ;
}

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

function horizontalRenderQ(valueQ: number, worldHalfQ: number): number {
  const cellCoordinate = valueQ / (TRAFFIC_CELL_METERS * TRAFFIC_Q_PER_METER);
  return Math.round(cellCoordinate * WORLD_CONFIG.cellSize * RENDER_Q_PER_UNIT - worldHalfQ);
}

function verticalRenderQ(valueQ: number): number {
  const logicalLevel = valueQ / TRAFFIC_Q_PER_METER;
  return Math.round(logicalLevel * WORLD_CONFIG.heightStep * RENDER_Q_PER_UNIT);
}

export function trafficPresentationPointForGraphNode(
  node: Readonly<{ xQ: number; yQ: number; zQ: number }>,
): TrafficPresentationPointQ {
  return Object.freeze({
    xQ: horizontalRenderQ(node.xQ, WORLD_HALF_X_Q),
    yQ: verticalRenderQ(node.yQ),
    zQ: horizontalRenderQ(node.zQ, WORLD_HALF_Z_Q),
  });
}

function graphsFor(
  input: Readonly<{
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
  }>,
): Readonly<{ walk: TrafficGraph; drive: TrafficGraph; combined: TrafficGraph }> {
  const walk = withBuildingRevision(
    derivePedestrianTrafficGraph(input.roads),
    input.buildingAccess.buildingRevision,
  );
  const drive = withBuildingRevision(
    deriveVehicleTrafficGraph(input.roads),
    input.buildingAccess.buildingRevision,
  );
  const nodeMap = new Map(
    [...walk.nodes, ...drive.nodes].map((node) => [node.nodeId, node] as const),
  );
  return Object.freeze({
    walk,
    drive,
    combined: Object.freeze({
      sourceRoadRevision: input.roads.roadRevision,
      sourceBuildingRevision: input.buildingAccess.buildingRevision,
      nodes: Object.freeze([...nodeMap.values()]),
      edges: Object.freeze([...walk.edges, ...drive.edges]),
    }),
  });
}

export function createTrafficPresentationRouteSegments(
  input: Readonly<{
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
    mode: 'Walk' | 'Drive';
    routeEdgeIds: readonly string[];
  }>,
): readonly TrafficPresentationRouteSegment[] {
  const graphs = graphsFor(input);
  const graph = input.mode === 'Walk' ? graphs.walk : graphs.drive;
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node] as const));
  const edgeById = new Map(graph.edges.map((edge) => [edge.edgeId, edge] as const));
  return Object.freeze(
    input.routeEdgeIds.flatMap((edgeId) => {
      const edge = edgeById.get(edgeId);
      if (edge === undefined) return [];
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) return [];
      return [
        Object.freeze({
          edgeId,
          from: trafficPresentationPointForGraphNode(from),
          to: trafficPresentationPointForGraphNode(to),
        }),
      ];
    }),
  );
}

export function createTrafficPresentationSnapshot(
  input: Readonly<{
    traffic: TrafficSnapshotV1;
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
  }>,
): TrafficPresentationSnapshot {
  const graphs = graphsFor(input);
  const nodeById = new Map(graphs.combined.nodes.map((node) => [node.nodeId, node] as const));
  const edgeById = new Map(graphs.combined.edges.map((edge) => [edge.edgeId, edge] as const));
  const logicalTripById = new Map(
    input.traffic.activeTrips.map((trip) => [trip.tripId, trip] as const),
  );
  const projection = createTrafficProjection({ snapshot: input.traffic, graph: graphs.combined });
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
      if (
        nextEdge !== undefined &&
        nextNode !== undefined &&
        nextEdge.fromNodeId === edge.toNodeId
      ) {
        turn = Object.freeze({
          previous: trafficPresentationPointForGraphNode(from),
          corner: trafficPresentationPointForGraphNode(to),
          next: trafficPresentationPointForGraphNode(nextNode),
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
        from: trafficPresentationPointForGraphNode(from),
        to: trafficPresentationPointForGraphNode(to),
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
