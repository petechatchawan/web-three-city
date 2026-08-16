import { TrafficContractError } from './errors.js';

export type TrafficNodeId = string;
export type TrafficEdgeId = string;
export type TrafficMode = 'Walk' | 'Drive';
export type TrafficTripStatus = 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
export type TrafficTripFailureReason = 'UnreachableDestination';
export type TrafficCardinalDirection = 'N' | 'E' | 'S' | 'W';

export const TRAFFIC_PROGRESS_MAX_Q = 1_000_000 as const;
export const TRAFFIC_POSITION_Q_PER_METER = 1_000 as const;

export interface RoadTrafficSourceCell {
  readonly x: number;
  readonly z: number;
  readonly definitionCode: number;
  readonly connectionMask: number;
  readonly elevationStartQ: number;
  readonly elevationEndQ: number;
}

export interface RoadTrafficSourceProjection {
  readonly roadRevision: number;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RoadTrafficSourceCell[];
}

export interface BuildingTrafficAccess {
  readonly buildingInstanceId: string;
  readonly frontageRoadX: number;
  readonly frontageRoadZ: number;
  readonly frontageDirection: TrafficCardinalDirection;
  readonly entranceXQ: number;
  readonly entranceYQ: number;
  readonly entranceZQ: number;
}

export interface BuildingTrafficAccessProjection {
  readonly buildingRevision: number;
  readonly accesses: readonly BuildingTrafficAccess[];
}

export interface TrafficGraphNode {
  readonly nodeId: TrafficNodeId;
  readonly xQ: number;
  readonly zQ: number;
  readonly yQ: number;
}

export interface TrafficGraphEdge {
  readonly edgeId: TrafficEdgeId;
  readonly fromNodeId: TrafficNodeId;
  readonly toNodeId: TrafficNodeId;
  readonly mode: TrafficMode;
  readonly lengthQ: number;
  readonly freeFlowTravelSeconds: number;
  readonly capacityUnits: number;
}

export interface TrafficGraph {
  readonly sourceRoadRevision: number;
  readonly sourceBuildingRevision: number;
  readonly nodes: readonly TrafficGraphNode[];
  readonly edges: readonly TrafficGraphEdge[];
}

export interface BuildingAccessNodePair {
  readonly buildingInstanceId: string;
  readonly walkAccessNodeId: TrafficNodeId;
  readonly driveAccessNodeId: TrafficNodeId;
}

export interface ActiveTransportTrip {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: TrafficMode;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly routeEdgeIds: readonly TrafficEdgeId[];
  readonly routeGraphRevision: number;
  readonly segmentIndex: number;
  readonly progressQ: number;
  readonly lastStableNodeId: TrafficNodeId;
  readonly queuedMovement: Readonly<{
    fromEdgeId: TrafficEdgeId;
    toEdgeId: TrafficEdgeId;
    arrivedAtGameSecond: number;
  }> | null;
  readonly status: TrafficTripStatus;
  readonly failureReason: TrafficTripFailureReason | null;
}

export function compareTrafficId(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

export function assertTrafficId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim().length === 0) {
    throw new TrafficContractError('traffic:invalid-id');
  }
}

export function assertTrafficSafeInteger(value: unknown, minimum = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new TrafficContractError('traffic:invalid-state');
  }
}

export function validateRoadTrafficSourceProjection(source: RoadTrafficSourceProjection): void {
  assertTrafficSafeInteger(source.roadRevision);
  assertTrafficSafeInteger(source.width, 1);
  assertTrafficSafeInteger(source.height, 1);
  const seen = new Set<string>();
  for (const cell of source.cells) {
    assertTrafficSafeInteger(cell.x);
    assertTrafficSafeInteger(cell.z);
    assertTrafficSafeInteger(cell.definitionCode, 1);
    assertTrafficSafeInteger(cell.connectionMask);
    if (cell.x >= source.width || cell.z >= source.height) {
      throw new TrafficContractError('traffic:invalid-source');
    }
    if (!Number.isSafeInteger(cell.elevationStartQ) || !Number.isSafeInteger(cell.elevationEndQ)) {
      throw new TrafficContractError('traffic:invalid-source');
    }
    const key = `${cell.x},${cell.z}`;
    if (seen.has(key)) throw new TrafficContractError('traffic:invalid-source');
    seen.add(key);
  }
}

export function validateTrafficGraph(graph: TrafficGraph): void {
  assertTrafficSafeInteger(graph.sourceRoadRevision);
  assertTrafficSafeInteger(graph.sourceBuildingRevision);
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    assertTrafficId(node.nodeId);
    if (
      !Number.isSafeInteger(node.xQ) ||
      !Number.isSafeInteger(node.yQ) ||
      !Number.isSafeInteger(node.zQ)
    ) {
      throw new TrafficContractError('traffic:invalid-graph');
    }
    if (nodeIds.has(node.nodeId)) throw new TrafficContractError('traffic:duplicate-node');
    nodeIds.add(node.nodeId);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    assertTrafficId(edge.edgeId);
    assertTrafficId(edge.fromNodeId);
    assertTrafficId(edge.toNodeId);
    assertTrafficSafeInteger(edge.lengthQ, 1);
    assertTrafficSafeInteger(edge.freeFlowTravelSeconds, 1);
    assertTrafficSafeInteger(edge.capacityUnits, 1);
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      throw new TrafficContractError('traffic:dangling-edge');
    }
    if (edgeIds.has(edge.edgeId)) throw new TrafficContractError('traffic:duplicate-edge');
    edgeIds.add(edge.edgeId);
  }
}

export function validateActiveTransportTrip(trip: ActiveTransportTrip): void {
  assertTrafficId(trip.tripId);
  assertTrafficId(trip.citizenId);
  assertTrafficId(trip.originBuildingId);
  assertTrafficId(trip.destinationBuildingId);
  assertTrafficSafeInteger(trip.routeGraphRevision);
  assertTrafficSafeInteger(trip.segmentIndex);
  assertTrafficSafeInteger(trip.progressQ);
  if (trip.progressQ > TRAFFIC_PROGRESS_MAX_Q)
    throw new TrafficContractError('traffic:invalid-trip');
  assertTrafficId(trip.lastStableNodeId);
  for (const edgeId of trip.routeEdgeIds) assertTrafficId(edgeId);
  if (trip.status === 'Active') {
    if (
      trip.failureReason !== null ||
      trip.routeEdgeIds.length === 0 ||
      trip.segmentIndex >= trip.routeEdgeIds.length
    ) {
      throw new TrafficContractError('traffic:invalid-trip');
    }
  }
  if (trip.status === 'Failed') {
    if (trip.failureReason !== 'UnreachableDestination')
      throw new TrafficContractError('traffic:invalid-trip');
  } else if (trip.failureReason !== null) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  if (trip.queuedMovement !== null) {
    assertTrafficId(trip.queuedMovement.fromEdgeId);
    assertTrafficId(trip.queuedMovement.toEdgeId);
    assertTrafficSafeInteger(trip.queuedMovement.arrivedAtGameSecond);
  }
}
