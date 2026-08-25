import { roadDefinitionForCode } from '@web-three-city/road-core';
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
import {
  deriveDirectedLanePath,
  type DirectedLanePathEdgeSpan,
  type TrafficRouteSegment,
} from '@web-three-city/traffic-three';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import type { TrafficModeGraphs } from './traffic-mode-graph-provider.js';

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
  readonly routeSegments: readonly TrafficPresentationRouteSegment[];
  readonly routeDistanceMillimeters: number;
  readonly driveMovementPhase?: string;
  readonly reservationResourceIds?: readonly string[];
}

export interface TrafficPresentationSnapshot {
  readonly trafficRevision: number;
  readonly agents: readonly TrafficPresentationAgent[];
  readonly edges: readonly TrafficEdgeProjection[];
}

export interface TrafficPresentationRouteSegment extends TrafficRouteSegment {
  readonly lengthMillimeters: number;
  readonly sourceEdgeId?: string;
  readonly kind?: 'lane' | 'connector';
}

interface TrafficPresentationRouteProjection {
  readonly segments: readonly TrafficPresentationRouteSegment[];
  readonly edgeSpans: readonly DirectedLanePathEdgeSpan[];
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
    trafficGraphs?: TrafficModeGraphs;
  }>,
): Readonly<{ walk: TrafficGraph; drive: TrafficGraph; combined: TrafficGraph }> {
  if (input.trafficGraphs !== undefined) {
    return Object.freeze({
      walk: input.trafficGraphs.pedestrian,
      drive: input.trafficGraphs.vehicle,
      combined: input.trafficGraphs.combined,
    });
  }
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

function segmentLengthMillimeters(
  from: TrafficPresentationPointQ,
  to: TrafficPresentationPointQ,
): number {
  const dx = to.xQ - from.xQ;
  const dy = to.yQ - from.yQ;
  const dz = to.zQ - from.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

function routeSegmentsForGraph(
  nodeById: ReadonlyMap<string, Readonly<{ xQ: number; yQ: number; zQ: number }>>,
  edgeById: ReadonlyMap<
    string,
    Readonly<{ edgeId: string; fromNodeId: string; toNodeId: string; lengthQ: number }>
  >,
  routeEdgeIds: readonly string[],
): readonly TrafficPresentationRouteSegment[] {
  return Object.freeze(
    routeEdgeIds.flatMap((edgeId) => {
      const edge = edgeById.get(edgeId);
      if (edge === undefined) return [];
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) return [];
      const renderedFrom = trafficPresentationPointForGraphNode(from);
      const renderedTo = trafficPresentationPointForGraphNode(to);
      return [
        Object.freeze({
          edgeId,
          sourceEdgeId: edgeId,
          from: renderedFrom,
          to: renderedTo,
          lengthMillimeters: segmentLengthMillimeters(renderedFrom, renderedTo),
        }),
      ];
    }),
  );
}

function centerlineEdgeSpans(
  segments: readonly TrafficPresentationRouteSegment[],
): readonly DirectedLanePathEdgeSpan[] {
  let distance = 0;
  return Object.freeze(
    segments.map((segment) => {
      const startDistanceMillimeters = distance;
      distance += segment.lengthMillimeters;
      return Object.freeze({
        sourceEdgeId: segment.sourceEdgeId ?? segment.edgeId,
        startDistanceMillimeters,
        endDistanceMillimeters: distance,
      });
    }),
  );
}

function roadCellKey(x: number, z: number): string {
  return `${x},${z}`;
}

type RoadCellLookup = ReadonlyMap<string, RoadTrafficSourceProjection['cells'][number]>;

function roadCellLookup(roads: RoadTrafficSourceProjection): RoadCellLookup {
  return new Map(roads.cells.map((cell) => [roadCellKey(cell.x, cell.z), cell] as const));
}

function roadCellCoordForDriveNode(nodeId: string): Readonly<{ x: number; z: number }> {
  const match = /^drive:(\d+),(\d+)$/.exec(nodeId);
  if (match === null) throw new Error('traffic-presentation:invalid-drive-node');
  return Object.freeze({ x: Number(match[1]), z: Number(match[2]) });
}

function driveLaneOffsetQ(
  edge: Readonly<{ fromNodeId: string; toNodeId: string }>,
  cells: RoadCellLookup,
): number {
  const fromCoord = roadCellCoordForDriveNode(edge.fromNodeId);
  const toCoord = roadCellCoordForDriveNode(edge.toNodeId);
  const fromCell = cells.get(roadCellKey(fromCoord.x, fromCoord.z));
  const toCell = cells.get(roadCellKey(toCoord.x, toCoord.z));
  if (fromCell === undefined || toCell === undefined) {
    throw new Error('traffic-presentation:missing-drive-road-cell');
  }
  const fromRoad = roadDefinitionForCode(fromCell.definitionCode);
  const toRoad = roadDefinitionForCode(toCell.definitionCode);
  if (fromRoad === null || toRoad === null) {
    throw new Error('traffic-presentation:empty-drive-road-cell');
  }
  return Math.round((Math.min(fromRoad.width, toRoad.width) * RENDER_Q_PER_UNIT) / 4);
}

function routeProjectionForGraph(
  input: Readonly<{
    roads: RoadTrafficSourceProjection;
    roadCells: RoadCellLookup;
    graph: TrafficGraph;
    mode: 'Walk' | 'Drive';
    routeEdgeIds: readonly string[];
  }>,
): TrafficPresentationRouteProjection {
  const nodeById = new Map(input.graph.nodes.map((node) => [node.nodeId, node] as const));
  const edgeById = new Map(input.graph.edges.map((edge) => [edge.edgeId, edge] as const));
  const centerline = routeSegmentsForGraph(nodeById, edgeById, input.routeEdgeIds);
  if (input.mode === 'Walk' || centerline.length === 0) {
    return Object.freeze({
      segments: centerline,
      edgeSpans: centerlineEdgeSpans(centerline),
    });
  }
  const laneOffsetsQ = input.routeEdgeIds.map((edgeId) => {
    const edge = edgeById.get(edgeId);
    if (edge === undefined) throw new Error('traffic-presentation:missing-drive-edge');
    return driveLaneOffsetQ(edge, input.roadCells);
  });
  const directed = deriveDirectedLanePath(centerline, { laneOffsetsQ });
  return Object.freeze({
    segments: Object.freeze(
      directed.segments.map((segment) =>
        Object.freeze({
          edgeId: segment.edgeId,
          sourceEdgeId: segment.sourceEdgeId,
          kind: segment.kind,
          from: segment.from,
          to: segment.to,
          lengthMillimeters: segment.lengthMillimeters,
          ...(segment.curve === undefined ? {} : { curve: segment.curve }),
          movementKind: segment.movementKind,
        }),
      ),
    ),
    edgeSpans: directed.edgeSpans,
  });
}

function sourceEdgeEndpoints(
  route: TrafficPresentationRouteProjection,
  sourceEdgeId: string,
): Readonly<{ from: TrafficPresentationPointQ; to: TrafficPresentationPointQ }> | null {
  const matching = route.segments.filter(
    (segment) => (segment.sourceEdgeId ?? segment.edgeId) === sourceEdgeId,
  );
  const first = matching[0];
  const last = matching.at(-1);
  if (first === undefined || last === undefined) return null;
  return Object.freeze({ from: first.from, to: last.to });
}

function routeDistanceForProgress(
  route: TrafficPresentationRouteProjection,
  sourceEdgeId: string,
  progressQ: number,
): number | null {
  const span = route.edgeSpans.find((candidate) => candidate.sourceEdgeId === sourceEdgeId);
  if (span === undefined) return null;
  const spanLength = span.endDistanceMillimeters - span.startDistanceMillimeters;
  return (
    span.startDistanceMillimeters + Math.floor((progressQ * spanLength) / TRAFFIC_PROGRESS_MAX_Q)
  );
}

function routeProjectionForAgent(
  input: Readonly<{
    mode: 'Walk' | 'Drive';
    roads: RoadTrafficSourceProjection;
    roadCells: RoadCellLookup;
    graph: TrafficGraph;
    routeEdgeIds: readonly string[];
  }>,
  cache: Map<string, TrafficPresentationRouteProjection>,
): TrafficPresentationRouteProjection {
  const key = `${input.mode}:${input.routeEdgeIds.join('\u0000')}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const route = routeProjectionForGraph(input);
  cache.set(key, route);
  return route;
}

function projectPresentationAgents(
  input: Readonly<{
    traffic: TrafficSnapshotV1;
    roads: RoadTrafficSourceProjection;
    roadCells: RoadCellLookup;
    graphs: Readonly<{ walk: TrafficGraph; drive: TrafficGraph }>;
    routeProjectionCache: Map<string, TrafficPresentationRouteProjection>;
  }>,
): readonly TrafficPresentationAgent[] {
  const edgeByGraph = Object.freeze({
    walk: new Map(input.graphs.walk.edges.map((edge) => [edge.edgeId, edge] as const)),
    drive: new Map(input.graphs.drive.edges.map((edge) => [edge.edgeId, edge] as const)),
  });
  const nodeByGraph = Object.freeze({
    walk: new Map(input.graphs.walk.nodes.map((node) => [node.nodeId, node] as const)),
    drive: new Map(input.graphs.drive.nodes.map((node) => [node.nodeId, node] as const)),
  });
  const agents = input.traffic.activeTrips.flatMap((trip) => {
    if (trip.status !== 'Active') return [];
    const graphKey = trip.mode === 'Walk' ? 'walk' : 'drive';
    const edgeById = edgeByGraph[graphKey];
    const nodeById = nodeByGraph[graphKey];
    const routeEdgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (routeEdgeId === undefined) return [];
    const currentEdge = edgeById.get(routeEdgeId);
    if (currentEdge === undefined) return [];
    const fromNode = nodeById.get(currentEdge.fromNodeId);
    const toNode = nodeById.get(currentEdge.toNodeId);
    if (fromNode === undefined || toNode === undefined) return [];
    const route = routeProjectionForAgent(
      {
        roads: input.roads,
        roadCells: input.roadCells,
        graph: graphKey === 'walk' ? input.graphs.walk : input.graphs.drive,
        mode: trip.mode,
        routeEdgeIds: trip.routeEdgeIds,
      },
      input.routeProjectionCache,
    );
    const endpoints = sourceEdgeEndpoints(route, routeEdgeId);
    const routeDistanceMillimeters = routeDistanceForProgress(route, routeEdgeId, trip.progressQ);
    if (endpoints === null || routeDistanceMillimeters === null) return [];
    const tripWithAuthority = trip as unknown as Readonly<{
      driveMovementPhase?: string;
      entryReservationResourceIds?: readonly string[];
      activeNodeTraversal?: Readonly<{ reservedResourceIds: readonly string[] }>;
    }>;
    return [
      Object.freeze({
        tripId: trip.tripId,
        citizenId: trip.citizenId,
        mode: trip.mode,
        routeEdgeId,
        progressQ: trip.progressQ,
        queued: trip.queuedMovement !== null,
        from: endpoints.from,
        to: endpoints.to,
        turn: null,
        routeSegments: route.segments,
        routeDistanceMillimeters,
        ...(tripWithAuthority.driveMovementPhase === undefined
          ? {}
          : { driveMovementPhase: tripWithAuthority.driveMovementPhase }),
        reservationResourceIds: Object.freeze([
          ...(tripWithAuthority.entryReservationResourceIds ?? []),
          ...(tripWithAuthority.activeNodeTraversal?.reservedResourceIds ?? []),
        ]),
      }),
    ];
  });
  return Object.freeze(
    agents.sort((first, second) =>
      first.tripId < second.tripId ? -1 : first.tripId > second.tripId ? 1 : 0,
    ),
  );
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
  const roadCells = roadCellLookup(input.roads);
  const graph = input.mode === 'Walk' ? graphs.walk : graphs.drive;
  return routeProjectionForGraph({
    roads: input.roads,
    roadCells,
    graph,
    mode: input.mode,
    routeEdgeIds: input.routeEdgeIds,
  }).segments;
}

export function createTrafficPresentationSnapshot(
  input: Readonly<{
    traffic: TrafficSnapshotV1;
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
    trafficGraphs?: TrafficModeGraphs;
    includeTrafficFlow?: boolean;
  }>,
): TrafficPresentationSnapshot {
  const graphs = graphsFor(input);
  const roadCells = roadCellLookup(input.roads);
  const routeProjectionCache = new Map<string, TrafficPresentationRouteProjection>();
  const agents = projectPresentationAgents({
    traffic: input.traffic,
    roads: input.roads,
    roadCells,
    graphs,
    routeProjectionCache,
  });
  const flowProjection =
    input.includeTrafficFlow === false
      ? null
      : createTrafficProjection({ snapshot: input.traffic, graph: graphs.combined });
  return Object.freeze({
    trafficRevision: input.traffic.revision,
    agents: Object.freeze(agents),
    edges: flowProjection?.edges ?? Object.freeze([]),
  });
}
