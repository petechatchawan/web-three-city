import { TrafficContractError } from './errors.js';
import type { AbsoluteTransportSecond } from './transport-time.js';

export type TrafficNodeId = string;
export type TrafficEdgeId = string;
export type TrafficMode = 'Walk' | 'Drive';
export type TrafficTripStatus = 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
export type DriveMovementPhase = 'WaitingForEntry' | 'Entering' | 'Travelling' | 'Leaving';
export type TrafficTripFailureReason = 'UnreachableDestination';
export type TrafficCardinalDirection = 'N' | 'E' | 'S' | 'W';
export type NodeTraversalClass = 'Merge' | 'ConflictJunction';
export type IntersectionMovementKind = 'Straight' | 'Left' | 'Right';

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

export interface ActiveTransportTripV2 {
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
    arrivedAtTransportSecond: AbsoluteTransportSecond;
  }> | null;
  readonly status: TrafficTripStatus;
  readonly failureReason: TrafficTripFailureReason | null;
  readonly driveMovementPhase: DriveMovementPhase | null;
  readonly entryServiceCredit?: number;
  readonly entryReservationResourceIds?: readonly string[];
  readonly activeNodeTraversal?: ActiveNodeTraversal;
}

export interface ActiveNodeTraversal {
  readonly nodeId: TrafficNodeId;
  readonly traversalClass: NodeTraversalClass;
  readonly incomingEdgeId: TrafficEdgeId;
  readonly outgoingEdgeId: TrafficEdgeId;
  readonly movementKind?: IntersectionMovementKind;
  readonly reservedResourceIds: readonly string[];
  readonly progressQ: number;
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

function validateTransportTripStatus(trip: ActiveTransportTripV2): void {
  if (
    trip.status === 'Active' &&
    (trip.failureReason !== null ||
      trip.routeEdgeIds.length === 0 ||
      trip.segmentIndex >= trip.routeEdgeIds.length)
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  if (trip.status === 'Failed') {
    if (trip.failureReason !== 'UnreachableDestination')
      throw new TrafficContractError('traffic:invalid-trip');
  } else if (trip.failureReason !== null) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
}

function validateDriveMovementPhase(trip: ActiveTransportTripV2): void {
  if (trip.mode === 'Walk') {
    if (trip.driveMovementPhase !== null) throw new TrafficContractError('traffic:invalid-trip');
    return;
  }
  if (trip.status !== 'Active') {
    if (trip.driveMovementPhase !== null) throw new TrafficContractError('traffic:invalid-trip');
    return;
  }
  if (trip.driveMovementPhase === null) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  if (
    (trip.driveMovementPhase === 'WaitingForEntry' || trip.driveMovementPhase === 'Entering') &&
    (trip.segmentIndex !== 0 || trip.progressQ !== 0 || trip.queuedMovement !== null)
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  if (
    trip.driveMovementPhase === 'Leaving' &&
    (trip.segmentIndex !== trip.routeEdgeIds.length - 1 ||
      trip.progressQ !== TRAFFIC_PROGRESS_MAX_Q ||
      trip.queuedMovement !== null)
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
}

function validateActiveNodeTraversal(trip: ActiveTransportTripV2): void {
  const traversal = trip.activeNodeTraversal;
  if (traversal === undefined) return;
  if (trip.mode !== 'Drive' || trip.status !== 'Active' || trip.queuedMovement !== null) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  assertTrafficId(traversal.nodeId);
  assertTrafficId(traversal.incomingEdgeId);
  assertTrafficId(traversal.outgoingEdgeId);
  assertTrafficSafeInteger(traversal.progressQ);
  if (traversal.progressQ > TRAFFIC_PROGRESS_MAX_Q) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  for (const resourceId of traversal.reservedResourceIds) assertTrafficId(resourceId);
}

function validateActiveTransportTripReservations(trip: ActiveTransportTripV2): void {
  assertTrafficSafeInteger(trip.entryServiceCredit ?? 0);
  for (const resourceId of trip.entryReservationResourceIds ?? []) assertTrafficId(resourceId);
  if (
    (trip.mode !== 'Drive' || trip.status !== 'Active') &&
    ((trip.entryServiceCredit ?? 0) !== 0 || (trip.entryReservationResourceIds?.length ?? 0) !== 0)
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
}

export function validateActiveTransportTripV2(trip: ActiveTransportTripV2): void {
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
  validateTransportTripStatus(trip);
  validateDriveMovementPhase(trip);
  if (trip.queuedMovement !== null) {
    assertTrafficId(trip.queuedMovement.fromEdgeId);
    assertTrafficId(trip.queuedMovement.toEdgeId);
    assertTrafficSafeInteger(trip.queuedMovement.arrivedAtTransportSecond);
  }
  validateActiveNodeTraversal(trip);
  validateActiveTransportTripReservations(trip);
}
