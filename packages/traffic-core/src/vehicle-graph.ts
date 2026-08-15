import {
  TRAFFIC_POSITION_Q_PER_METER,
  compareTrafficId,
  validateRoadTrafficSourceProjection,
  validateTrafficGraph,
  type RoadTrafficSourceCell,
  type RoadTrafficSourceProjection,
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
const ROAD_NORTH = 1 << 0;
const ROAD_EAST = 1 << 1;
const ROAD_SOUTH = 1 << 2;
const ROAD_WEST = 1 << 3;

const DIRECTIONS = Object.freeze([
  Object.freeze({ name: 'N', dx: 0, dz: -1, bit: ROAD_NORTH, opposite: ROAD_SOUTH }),
  Object.freeze({ name: 'E', dx: 1, dz: 0, bit: ROAD_EAST, opposite: ROAD_WEST }),
  Object.freeze({ name: 'S', dx: 0, dz: 1, bit: ROAD_SOUTH, opposite: ROAD_NORTH }),
  Object.freeze({ name: 'W', dx: -1, dz: 0, bit: ROAD_WEST, opposite: ROAD_EAST }),
]);

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

export function driveNodeId(x: number, z: number): string {
  return `drive:${x},${z}`;
}

function driveEdgeId(from: RoadTrafficSourceCell, to: RoadTrafficSourceCell): string {
  return `drive:${from.x},${from.z}->${to.x},${to.z}`;
}

function nodeFor(cell: RoadTrafficSourceCell): TrafficGraphNode {
  const yQ = Math.round((cell.elevationStartQ + cell.elevationEndQ) / 2);
  return Object.freeze({
    nodeId: driveNodeId(cell.x, cell.z),
    xQ: cell.x * CELL_SIZE_Q + HALF_CELL_Q,
    yQ,
    zQ: cell.z * CELL_SIZE_Q + HALF_CELL_Q,
  });
}

function edgeLengthQ(from: TrafficGraphNode, to: TrafficGraphNode): number {
  const dx = to.xQ - from.xQ;
  const dy = to.yQ - from.yQ;
  const dz = to.zQ - from.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

export function deriveVehicleTrafficGraph(
  roads: RoadTrafficSourceProjection,
  profiles: readonly TrafficRoadProfileV1[] = FOUNDATION_TRAFFIC_ROAD_PROFILES,
): TrafficGraph {
  validateRoadTrafficSourceProjection(roads);
  const sortedCells = [...roads.cells].sort((a, b) => a.z - b.z || a.x - b.x);
  const byCell = new Map(sortedCells.map((cell) => [cellKey(cell.x, cell.z), cell] as const));
  const nodes = sortedCells.map(nodeFor);
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node] as const));
  const edges: TrafficGraphEdge[] = [];

  for (const cell of sortedCells) {
    const fromNode = nodeById.get(driveNodeId(cell.x, cell.z))!;
    for (const direction of DIRECTIONS) {
      if ((cell.connectionMask & direction.bit) === 0) continue;
      const neighbor = byCell.get(cellKey(cell.x + direction.dx, cell.z + direction.dz));
      if (neighbor === undefined || (neighbor.connectionMask & direction.opposite) === 0) continue;
      const toNode = nodeById.get(driveNodeId(neighbor.x, neighbor.z))!;
      const currentProfile = resolveTrafficRoadProfile(cell.definitionCode, profiles);
      const neighborProfile = resolveTrafficRoadProfile(neighbor.definitionCode, profiles);
      const lengthQ = edgeLengthQ(fromNode, toNode);
      const speed = Math.min(
        currentProfile.freeFlowSpeedMillimetersPerSecond,
        neighborProfile.freeFlowSpeedMillimetersPerSecond,
      );
      edges.push(
        Object.freeze({
          edgeId: driveEdgeId(cell, neighbor),
          fromNodeId: fromNode.nodeId,
          toNodeId: toNode.nodeId,
          mode: 'Drive' as const,
          lengthQ,
          freeFlowTravelSeconds: Math.max(1, Math.ceil(lengthQ / speed)),
          capacityUnits: Math.min(currentProfile.edgeCapacityUnits, neighborProfile.edgeCapacityUnits),
        }),
      );
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
