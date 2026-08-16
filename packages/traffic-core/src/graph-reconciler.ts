import {
  compareTrafficId,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceCell,
  type RoadTrafficSourceProjection,
  type TrafficGraph,
  type TrafficGraphEdge,
  type TrafficGraphNode,
} from './contracts.js';
import { derivePedestrianTrafficGraph } from './pedestrian-graph.js';
import { deriveVehicleTrafficGraph } from './vehicle-graph.js';

export interface TrafficGraphDirtyRegion {
  readonly changedRoadCells: readonly Readonly<{ x: number; z: number }>[];
  readonly changedBuildingIds: readonly string[];
}

export interface TrafficGraphReconciliationResult {
  readonly vehicleGraph: TrafficGraph;
  readonly pedestrianGraph: TrafficGraph;
  readonly fullRebuild: boolean;
  readonly rebuiltRoadCellKeys: readonly string[];
  readonly changedBuildingIds: readonly string[];
}

const CARDINAL = Object.freeze([
  Object.freeze({ dx: 0, dz: -1 }),
  Object.freeze({ dx: 1, dz: 0 }),
  Object.freeze({ dx: 0, dz: 1 }),
  Object.freeze({ dx: -1, dz: 0 }),
]);

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

function parseNodeCell(nodeId: string): string | null {
  if (nodeId.startsWith('drive:')) {
    const coordinates = nodeId.slice('drive:'.length);
    return /^\d+,\d+$/.test(coordinates) ? coordinates : null;
  }
  if (nodeId.startsWith('walk:')) {
    const parts = nodeId.slice('walk:'.length).split(':');
    return parts.length === 2 && /^\d+,\d+$/.test(parts[0]!) ? parts[0]! : null;
  }
  return null;
}

function inBounds(
  cell: Readonly<{ x: number; z: number }>,
  roads: RoadTrafficSourceProjection,
): boolean {
  return cell.x >= 0 && cell.z >= 0 && cell.x < roads.width && cell.z < roads.height;
}

function boundedCardinalNeighbors(
  cell: Readonly<{ x: number; z: number }>,
  roads: RoadTrafficSourceProjection,
): readonly Readonly<{ x: number; z: number }>[] {
  return CARDINAL.map((direction) =>
    Object.freeze({ x: cell.x + direction.dx, z: cell.z + direction.dz }),
  ).filter((neighbor) => inBounds(neighbor, roads));
}

function expandCells(
  cells: readonly Readonly<{ x: number; z: number }>[],
  roads: RoadTrafficSourceProjection,
  radius: number,
): ReadonlySet<string> {
  let frontier = new Map<string, Readonly<{ x: number; z: number }>>();
  for (const cell of cells) {
    if (inBounds(cell, roads)) frontier.set(cellKey(cell.x, cell.z), cell);
  }
  const all = new Map(frontier);
  for (let step = 0; step < radius; step += 1) {
    const next = new Map<string, Readonly<{ x: number; z: number }>>();
    for (const cell of frontier.values()) {
      for (const neighbor of boundedCardinalNeighbors(cell, roads)) {
        const key = cellKey(neighbor.x, neighbor.z);
        if (!all.has(key)) next.set(key, neighbor);
      }
    }
    for (const [key, cell] of next) all.set(key, cell);
    frontier = next;
  }
  return new Set(all.keys());
}

function filteredRoadProjection(
  roads: RoadTrafficSourceProjection,
  keys: ReadonlySet<string>,
): RoadTrafficSourceProjection {
  const cells: RoadTrafficSourceCell[] = [];
  for (const cell of roads.cells) {
    if (keys.has(cellKey(cell.x, cell.z))) cells.push(cell);
  }
  return Object.freeze({
    roadRevision: roads.roadRevision,
    width: roads.width,
    height: roads.height,
    cells: Object.freeze(cells),
  });
}

function withBuildingRevision(graph: TrafficGraph, buildingRevision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: buildingRevision });
}

function nodeTouchesAffected(node: TrafficGraphNode, affectedCellKeys: ReadonlySet<string>): boolean {
  const key = parseNodeCell(node.nodeId);
  return key !== null && affectedCellKeys.has(key);
}

function edgeTouchesAffected(edge: TrafficGraphEdge, affectedCellKeys: ReadonlySet<string>): boolean {
  const fromKey = parseNodeCell(edge.fromNodeId);
  const toKey = parseNodeCell(edge.toNodeId);
  return (
    (fromKey !== null && affectedCellKeys.has(fromKey)) ||
    (toKey !== null && affectedCellKeys.has(toKey))
  );
}

function removedNodeIdsFor(
  previous: TrafficGraph,
  affectedCellKeys: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set(
    previous.nodes
      .filter((node) => nodeTouchesAffected(node, affectedCellKeys))
      .map((node) => node.nodeId),
  );
}

function mergeGraphNodes(
  previous: TrafficGraph,
  local: TrafficGraph,
  affectedCellKeys: ReadonlySet<string>,
  removedNodeIds: ReadonlySet<string>,
): Map<string, TrafficGraphNode> {
  const nextNodes = new Map<string, TrafficGraphNode>();
  for (const node of previous.nodes) {
    if (!removedNodeIds.has(node.nodeId)) nextNodes.set(node.nodeId, node);
  }
  for (const node of local.nodes) {
    if (nodeTouchesAffected(node, affectedCellKeys)) nextNodes.set(node.nodeId, node);
  }
  return nextNodes;
}

function localAffectedEdges(
  local: TrafficGraph,
  affectedCellKeys: ReadonlySet<string>,
): readonly TrafficGraphEdge[] {
  return local.edges.filter((edge) => edgeTouchesAffected(edge, affectedCellKeys));
}

function mergeGraphEdges(
  previous: TrafficGraph,
  localEdges: readonly TrafficGraphEdge[],
  affectedCellKeys: ReadonlySet<string>,
  removedNodeIds: ReadonlySet<string>,
  nextNodes: ReadonlyMap<string, TrafficGraphNode>,
): Map<string, TrafficGraphEdge> {
  const nextEdges = new Map<string, TrafficGraphEdge>();
  for (const edge of previous.edges) {
    if (edgeTouchesAffected(edge, affectedCellKeys)) continue;
    if (removedNodeIds.has(edge.fromNodeId) || removedNodeIds.has(edge.toNodeId)) continue;
    nextEdges.set(edge.edgeId, edge);
  }
  for (const edge of localEdges) {
    if (nextNodes.has(edge.fromNodeId) && nextNodes.has(edge.toNodeId)) {
      nextEdges.set(edge.edgeId, edge);
    }
  }
  return nextEdges;
}

function mergeLocalGraph(
  input: Readonly<{
    previous: TrafficGraph;
    local: TrafficGraph;
    affectedCellKeys: ReadonlySet<string>;
    roadRevision: number;
    buildingRevision: number;
  }>,
): TrafficGraph {
  const removedNodeIds = removedNodeIdsFor(input.previous, input.affectedCellKeys);
  const nextNodes = mergeGraphNodes(
    input.previous,
    input.local,
    input.affectedCellKeys,
    removedNodeIds,
  );
  const nextEdges = mergeGraphEdges(
    input.previous,
    localAffectedEdges(input.local, input.affectedCellKeys),
    input.affectedCellKeys,
    removedNodeIds,
    nextNodes,
  );
  const nodes = [...nextNodes.values()].sort((a, b) => compareTrafficId(a.nodeId, b.nodeId));
  const edges = [...nextEdges.values()].sort((a, b) => compareTrafficId(a.edgeId, b.edgeId));
  return Object.freeze({
    sourceRoadRevision: input.roadRevision,
    sourceBuildingRevision: input.buildingRevision,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

function fullGraphs(
  roads: RoadTrafficSourceProjection,
  buildingRevision: number,
): Readonly<{ vehicleGraph: TrafficGraph; pedestrianGraph: TrafficGraph }> {
  return Object.freeze({
    vehicleGraph: withBuildingRevision(deriveVehicleTrafficGraph(roads), buildingRevision),
    pedestrianGraph: withBuildingRevision(derivePedestrianTrafficGraph(roads), buildingRevision),
  });
}

export function reconcileTrafficGraphs(
  input: Readonly<{
    previousVehicleGraph: TrafficGraph;
    previousPedestrianGraph: TrafficGraph;
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
    dirty: TrafficGraphDirtyRegion;
  }>,
): TrafficGraphReconciliationResult {
  const buildingRevision = input.buildingAccess.buildingRevision;
  const changedBuildingIds = Object.freeze(
    [...new Set(input.dirty.changedBuildingIds)].sort(compareTrafficId),
  );
  const affected = expandCells(input.dirty.changedRoadCells, input.roads, 1);
  const expectedPreviousRoadRevision = Math.max(0, input.roads.roadRevision - 1);
  const previousCoherent =
    input.previousVehicleGraph.sourceRoadRevision ===
      input.previousPedestrianGraph.sourceRoadRevision &&
    input.previousVehicleGraph.sourceBuildingRevision ===
      input.previousPedestrianGraph.sourceBuildingRevision;

  const canReuseUnchangedTopology =
    previousCoherent &&
    input.previousVehicleGraph.sourceRoadRevision === input.roads.roadRevision &&
    affected.size === 0;
  if (canReuseUnchangedTopology) {
    return Object.freeze({
      vehicleGraph: withBuildingRevision(input.previousVehicleGraph, buildingRevision),
      pedestrianGraph: withBuildingRevision(input.previousPedestrianGraph, buildingRevision),
      fullRebuild: false,
      rebuiltRoadCellKeys: Object.freeze([]),
      changedBuildingIds,
    });
  }

  const canIncremental =
    previousCoherent &&
    input.previousVehicleGraph.sourceRoadRevision === expectedPreviousRoadRevision &&
    input.roads.roadRevision > 0 &&
    affected.size > 0;
  if (!canIncremental) {
    const full = fullGraphs(input.roads, buildingRevision);
    return Object.freeze({
      ...full,
      fullRebuild: true,
      rebuiltRoadCellKeys: Object.freeze(
        [...new Set(input.roads.cells.map((cell) => cellKey(cell.x, cell.z)))].sort(
          compareTrafficId,
        ),
      ),
      changedBuildingIds,
    });
  }

  // A second cardinal halo is required while deriving the local graph so that
  // edges crossing the first dirty halo's boundary can be regenerated without
  // scanning the complete Road projection.
  const derivationHalo = expandCells(
    [...affected].map((key) => {
      const [x, z] = key.split(',').map(Number);
      return Object.freeze({ x: x!, z: z! });
    }),
    input.roads,
    1,
  );
  const localRoads = filteredRoadProjection(input.roads, derivationHalo);
  const localVehicle = deriveVehicleTrafficGraph(localRoads);
  const localPedestrian = derivePedestrianTrafficGraph(localRoads);

  return Object.freeze({
    vehicleGraph: mergeLocalGraph({
      previous: input.previousVehicleGraph,
      local: localVehicle,
      affectedCellKeys: affected,
      roadRevision: input.roads.roadRevision,
      buildingRevision,
    }),
    pedestrianGraph: mergeLocalGraph({
      previous: input.previousPedestrianGraph,
      local: localPedestrian,
      affectedCellKeys: affected,
      roadRevision: input.roads.roadRevision,
      buildingRevision,
    }),
    fullRebuild: false,
    rebuiltRoadCellKeys: Object.freeze([...affected].sort(compareTrafficId)),
    changedBuildingIds,
  });
}
