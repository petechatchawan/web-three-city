import {
  TRAFFIC_POSITION_Q_PER_METER,
  validateRoadTrafficSourceProjection,
  type RoadTrafficSourceCell,
  type RoadTrafficSourceProjection,
  type TrafficCardinalDirection,
  type TrafficGraph,
  type TrafficGraphEdge,
  type TrafficGraphNode,
} from './contracts.js';
import {
  FOUNDATION_TRAFFIC_ROAD_PROFILES,
  resolveTrafficRoadProfile,
  type TrafficRoadProfileV1,
} from './road-profile.js';

const CELL_SIZE_Q = 8 * TRAFFIC_POSITION_Q_PER_METER;
const HALF_CELL_Q = CELL_SIZE_Q / 2;
const FOUNDATION_PEDESTRIAN_SPEED_MILLIMETERS_PER_SECOND = 1_400;
const ROAD_NORTH = 1;
const ROAD_EAST = 2;
const ROAD_SOUTH = 4;
const ROAD_WEST = 8;

const DIRECTIONS = Object.freeze([
  Object.freeze({
    side: 'N' as const,
    dx: 0,
    dz: -1,
    bit: ROAD_NORTH,
    oppositeBit: ROAD_SOUTH,
    oppositeSide: 'S' as const,
  }),
  Object.freeze({
    side: 'E' as const,
    dx: 1,
    dz: 0,
    bit: ROAD_EAST,
    oppositeBit: ROAD_WEST,
    oppositeSide: 'W' as const,
  }),
  Object.freeze({
    side: 'S' as const,
    dx: 0,
    dz: 1,
    bit: ROAD_SOUTH,
    oppositeBit: ROAD_NORTH,
    oppositeSide: 'N' as const,
  }),
  Object.freeze({
    side: 'W' as const,
    dx: -1,
    dz: 0,
    bit: ROAD_WEST,
    oppositeBit: ROAD_EAST,
    oppositeSide: 'E' as const,
  }),
]);

const RING: readonly (readonly [TrafficCardinalDirection, TrafficCardinalDirection])[] =
  Object.freeze([
    Object.freeze(['N', 'E']) as readonly ['N', 'E'],
    Object.freeze(['E', 'S']) as readonly ['E', 'S'],
    Object.freeze(['S', 'W']) as readonly ['S', 'W'],
    Object.freeze(['W', 'N']) as readonly ['W', 'N'],
  ]);

function key(x: number, z: number): string {
  return `${x},${z}`;
}

export function walkSideNodeId(x: number, z: number, side: TrafficCardinalDirection): string {
  return `walk:${x},${z}:${side}`;
}

function nodeFor(
  cell: RoadTrafficSourceCell,
  side: TrafficCardinalDirection,
  offsetQ: number,
): TrafficGraphNode {
  const centerX = cell.x * CELL_SIZE_Q + HALF_CELL_Q;
  const centerZ = cell.z * CELL_SIZE_Q + HALF_CELL_Q;
  const yQ = Math.round((cell.elevationStartQ + cell.elevationEndQ) / 2);
  const delta =
    side === 'N'
      ? { x: 0, z: -offsetQ }
      : side === 'E'
        ? { x: offsetQ, z: 0 }
        : side === 'S'
          ? { x: 0, z: offsetQ }
          : { x: -offsetQ, z: 0 };
  return Object.freeze({
    nodeId: walkSideNodeId(cell.x, cell.z, side),
    xQ: centerX + delta.x,
    yQ,
    zQ: centerZ + delta.z,
  });
}

function edgeLengthQ(from: TrafficGraphNode, to: TrafficGraphNode): number {
  const dx = to.xQ - from.xQ;
  const dy = to.yQ - from.yQ;
  const dz = to.zQ - from.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

function edge(edgeId: string, from: TrafficGraphNode, to: TrafficGraphNode): TrafficGraphEdge {
  const lengthQ = edgeLengthQ(from, to);
  return Object.freeze({
    edgeId,
    fromNodeId: from.nodeId,
    toNodeId: to.nodeId,
    mode: 'Walk' as const,
    lengthQ,
    freeFlowTravelSeconds: Math.max(
      1,
      Math.ceil(lengthQ / FOUNDATION_PEDESTRIAN_SPEED_MILLIMETERS_PER_SECOND),
    ),
    capacityUnits: Number.MAX_SAFE_INTEGER,
  });
}

export function derivePedestrianTrafficGraph(
  roads: RoadTrafficSourceProjection,
  profiles: readonly TrafficRoadProfileV1[] = FOUNDATION_TRAFFIC_ROAD_PROFILES,
): TrafficGraph {
  validateRoadTrafficSourceProjection(roads);
  const sortedCells = [...roads.cells].sort((a, b) => a.z - b.z || a.x - b.x);
  const byCell = new Map(sortedCells.map((cell) => [key(cell.x, cell.z), cell] as const));
  const nodes: TrafficGraphNode[] = [];
  const edges: TrafficGraphEdge[] = [];
  const nodesById = new Map<string, TrafficGraphNode>();

  for (const cell of sortedCells) {
    const profile = resolveTrafficRoadProfile(cell.definitionCode, profiles);
    for (const direction of DIRECTIONS) {
      const node = nodeFor(cell, direction.side, profile.pedestrianOffsetMillimeters);
      nodes.push(node);
      nodesById.set(node.nodeId, node);
    }
  }

  for (const cell of sortedCells) {
    resolveTrafficRoadProfile(cell.definitionCode, profiles);
    for (const [firstSide, secondSide] of RING) {
      const first = nodesById.get(walkSideNodeId(cell.x, cell.z, firstSide))!;
      const second = nodesById.get(walkSideNodeId(cell.x, cell.z, secondSide))!;
      edges.push(edge(`walk:${cell.x},${cell.z}:${firstSide}->${secondSide}`, first, second));
      edges.push(edge(`walk:${cell.x},${cell.z}:${secondSide}->${firstSide}`, second, first));
    }

    for (const direction of DIRECTIONS) {
      if ((cell.connectionMask & direction.bit) === 0) continue;
      const neighbor = byCell.get(key(cell.x + direction.dx, cell.z + direction.dz));
      if (neighbor === undefined || (neighbor.connectionMask & direction.oppositeBit) === 0) {
        continue;
      }
      resolveTrafficRoadProfile(neighbor.definitionCode, profiles);
      const from = nodesById.get(walkSideNodeId(cell.x, cell.z, direction.side))!;
      const to = nodesById.get(walkSideNodeId(neighbor.x, neighbor.z, direction.oppositeSide))!;
      edges.push(
        edge(
          `walk:${cell.x},${cell.z}:${direction.side}->${neighbor.x},${neighbor.z}:${direction.oppositeSide}`,
          from,
          to,
        ),
      );
    }
  }

  return Object.freeze({
    sourceRoadRevision: roads.roadRevision,
    sourceBuildingRevision: 0,
    nodes: Object.freeze(
      nodes.sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0)),
    ),
    edges: Object.freeze(
      edges.sort((a, b) => (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0)),
    ),
  });
}
