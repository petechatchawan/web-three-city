import {
  TRAFFIC_POSITION_Q_PER_METER,
  compareTrafficId,
  validateRoadTrafficSourceProjection,
  validateTrafficGraph,
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
const WALK_SPEED_Q_PER_SECOND = 1_400;
const WALK_EDGE_CAPACITY = 100;
const ROAD_NORTH = 1 << 0;
const ROAD_EAST = 1 << 1;
const ROAD_SOUTH = 1 << 2;
const ROAD_WEST = 1 << 3;

const DIRECTIONS: readonly Readonly<{
  side: TrafficCardinalDirection;
  dx: number;
  dz: number;
  bit: number;
  oppositeBit: number;
  oppositeSide: TrafficCardinalDirection;
}>[] = Object.freeze([
  Object.freeze({ side: 'N', dx: 0, dz: -1, bit: ROAD_NORTH, oppositeBit: ROAD_SOUTH, oppositeSide: 'S' }),
  Object.freeze({ side: 'E', dx: 1, dz: 0, bit: ROAD_EAST, oppositeBit: ROAD_WEST, oppositeSide: 'W' }),
  Object.freeze({ side: 'S', dx: 0, dz: 1, bit: ROAD_SOUTH, oppositeBit: ROAD_NORTH, oppositeSide: 'N' }),
  Object.freeze({ side: 'W', dx: -1, dz: 0, bit: ROAD_WEST, oppositeBit: ROAD_EAST, oppositeSide: 'E' }),
]);

const RING: readonly readonly [TrafficCardinalDirection, TrafficCardinalDirection][] = Object.freeze([
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

function lengthQ(first: TrafficGraphNode, second: TrafficGraphNode): number {
  const dx = second.xQ - first.xQ;
  const dy = second.yQ - first.yQ;
  const dz = second.zQ - first.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

function walkEdge(
  from: TrafficGraphNode,
  to: TrafficGraphNode,
  label: string,
): TrafficGraphEdge {
  const distance = lengthQ(from, to);
  return Object.freeze({
    edgeId: `walk:${label}:${from.nodeId}->${to.nodeId}`,
    fromNodeId: from.nodeId,
    toNodeId: to.nodeId,
    mode: 'Walk',
    lengthQ: distance,
    freeFlowTravelSeconds: Math.max(1, Math.ceil(distance / WALK_SPEED_Q_PER_SECOND)),
    capacityUnits: WALK_EDGE_CAPACITY,
  });
}

export function derivePedestrianTrafficGraph(
  roads: RoadTrafficSourceProjection,
  profiles: readonly TrafficRoadProfileV1[] = FOUNDATION_TRAFFIC_ROAD_PROFILES,
): TrafficGraph {
  validateRoadTrafficSourceProjection(roads);
  const cells = [...roads.cells].sort((a, b) => a.z - b.z || a.x - b.x);
  const byCell = new Map(cells.map((cell) => [key(cell.x, cell.z), cell] as const));
  const nodes: TrafficGraphNode[] = [];
  const nodeById = new Map<string, TrafficGraphNode>();

  for (const cell of cells) {
    const profile = resolveTrafficRoadProfile(cell.definitionCode, profiles);
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const node = nodeFor(cell, side, profile.pedestrianOffsetMillimeters);
      nodes.push(node);
      nodeById.set(node.nodeId, node);
    }
  }

  const edges: TrafficGraphEdge[] = [];
  for (const cell of cells) {
    for (const [fromSide, toSide] of RING) {
      const from = nodeById.get(walkSideNodeId(cell.x, cell.z, fromSide))!;
      const to = nodeById.get(walkSideNodeId(cell.x, cell.z, toSide))!;
      edges.push(walkEdge(from, to, `ring:${cell.x},${cell.z}`));
      edges.push(walkEdge(to, from, `ring:${cell.x},${cell.z}`));
    }
    for (const direction of DIRECTIONS) {
      if ((cell.connectionMask & direction.bit) === 0) continue;
      const neighbor = byCell.get(key(cell.x + direction.dx, cell.z + direction.dz));
      if (neighbor === undefined || (neighbor.connectionMask & direction.oppositeBit) === 0) continue;
      const from = nodeById.get(walkSideNodeId(cell.x, cell.z, direction.side))!;
      const to = nodeById.get(
        walkSideNodeId(neighbor.x, neighbor.z, direction.oppositeSide),
      )!;
      edges.push(walkEdge(from, to, `link:${cell.x},${cell.z}`));
    }
  }

  nodes.sort((a, b) => compareTrafficId(a.nodeId, b.nodeId));
  edges.sort((a, b) => compareTrafficId(a.edgeId, b.edgeId));
  const graph: TrafficGraph = Object.freeze({
    sourceRoadRevision: roads.roadRevision,
    sourceBuildingRevision: 0,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
  validateTrafficGraph(graph);
  return graph;
}
