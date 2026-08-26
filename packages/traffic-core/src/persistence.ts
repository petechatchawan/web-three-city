import {
  TRAFFIC_PROGRESS_MAX_Q,
  type ActiveNodeTraversal,
  type ActiveTransportTrip,
  type ActiveTransportTripV2,
  type DriveMovementPhase,
  type TrafficGraph,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import {
  TRAFFIC_POLICY_VERSION,
  TRAFFIC_SCHEMA_VERSION,
  createTrafficSnapshot,
  createTrafficSnapshotV2,
  type TrafficSnapshotV1,
  type TrafficSnapshotV2,
} from './traffic-snapshot.js';
import { hasCanonicalDriveOverlap } from './traffic-migration.js';

export interface TrafficSaveV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly activeTrips: readonly ActiveTransportTrip[];
}

export interface TrafficSaveV2 {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly timeCursor: TrafficSnapshotV2['timeCursor'];
  readonly activeTrips: readonly ActiveTransportTripV2[];
}

export type TrafficSaveV2DecodeResult =
  | Readonly<{ ok: true; value: TrafficSnapshotV2 }>
  | Readonly<{ ok: false; error: Readonly<{ code: 'traffic-save:invalid' }> }>;

export type TrafficSaveDecodeResult =
  | Readonly<{ ok: true; value: TrafficSnapshotV1 }>
  | Readonly<{ ok: false; error: Readonly<{ code: 'traffic-save:invalid' }> }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseQueuedMovement(value: unknown): ActiveTransportTrip['queuedMovement'] | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (
    typeof value.fromEdgeId !== 'string' ||
    typeof value.toEdgeId !== 'string' ||
    !Number.isSafeInteger(value.arrivedAtGameSecond) ||
    (value.arrivedAtGameSecond as number) < 0
  ) {
    return undefined;
  }
  return Object.freeze({
    fromEdgeId: value.fromEdgeId,
    toEdgeId: value.toEdgeId,
    arrivedAtGameSecond: value.arrivedAtGameSecond as number,
  });
}

function parseTrip(value: unknown): ActiveTransportTrip | null {
  if (!isRecord(value)) return null;
  const queuedMovement = parseQueuedMovement(value.queuedMovement);
  if (queuedMovement === undefined) return null;
  if (
    typeof value.tripId !== 'string' ||
    typeof value.citizenId !== 'string' ||
    (value.mode !== 'Walk' && value.mode !== 'Drive') ||
    typeof value.originBuildingId !== 'string' ||
    typeof value.destinationBuildingId !== 'string' ||
    !Array.isArray(value.routeEdgeIds) ||
    value.routeEdgeIds.some((edgeId) => typeof edgeId !== 'string') ||
    !Number.isSafeInteger(value.routeGraphRevision) ||
    !Number.isSafeInteger(value.segmentIndex) ||
    !Number.isSafeInteger(value.progressQ) ||
    (value.progressQ as number) < 0 ||
    (value.progressQ as number) > TRAFFIC_PROGRESS_MAX_Q ||
    typeof value.lastStableNodeId !== 'string' ||
    !['Active', 'Arrived', 'Failed', 'Cancelled'].includes(String(value.status)) ||
    (value.failureReason !== null && value.failureReason !== 'UnreachableDestination')
  ) {
    return null;
  }
  return Object.freeze({
    tripId: value.tripId,
    citizenId: value.citizenId,
    mode: value.mode,
    originBuildingId: value.originBuildingId,
    destinationBuildingId: value.destinationBuildingId,
    routeEdgeIds: Object.freeze([...(value.routeEdgeIds as string[])]),
    routeGraphRevision: value.routeGraphRevision as number,
    segmentIndex: value.segmentIndex as number,
    progressQ: value.progressQ as number,
    lastStableNodeId: value.lastStableNodeId,
    queuedMovement,
    status: value.status as ActiveTransportTrip['status'],
    failureReason: value.failureReason as ActiveTransportTrip['failureReason'],
  });
}

function parseTripV2(value: unknown): ActiveTransportTripV2 | null {
  if (!isRecord(value)) return null;
  const queuedMovement = parseQueuedMovementV2(value.queuedMovement);
  const traversal = parseActiveNodeTraversal(value.activeNodeTraversal);
  const driveMovementPhase = parseDriveMovementPhase(value.driveMovementPhase);
  if (
    queuedMovement === undefined ||
    traversal === null ||
    driveMovementPhase === undefined ||
    !validTripV2Fields(value)
  )
    return null;
  return Object.freeze({
    tripId: value.tripId,
    citizenId: value.citizenId,
    mode: value.mode,
    originBuildingId: value.originBuildingId,
    destinationBuildingId: value.destinationBuildingId,
    routeEdgeIds: Object.freeze([...(value.routeEdgeIds as string[])]),
    routeGraphRevision: value.routeGraphRevision as number,
    segmentIndex: value.segmentIndex as number,
    progressQ: value.progressQ as number,
    lastStableNodeId: value.lastStableNodeId,
    queuedMovement,
    status: value.status as ActiveTransportTripV2['status'],
    failureReason: value.failureReason as ActiveTransportTripV2['failureReason'],
    driveMovementPhase,
    entryServiceCredit: value.entryServiceCredit as number,
    entryReservationResourceIds: Object.freeze([
      ...(value.entryReservationResourceIds as string[]),
    ]),
    ...(traversal === undefined
      ? {}
      : {
          activeNodeTraversal: Object.freeze({
            nodeId: traversal.nodeId,
            traversalClass: traversal.traversalClass,
            incomingEdgeId: traversal.incomingEdgeId,
            outgoingEdgeId: traversal.outgoingEdgeId,
            ...(traversal.movementKind === undefined
              ? {}
              : { movementKind: traversal.movementKind }),
            reservedResourceIds: Object.freeze([...(traversal.reservedResourceIds as string[])]),
            progressQ: traversal.progressQ as number,
          }),
        }),
  }) as unknown as ActiveTransportTripV2;
}

function parseQueuedMovementV2(
  value: unknown,
): ActiveTransportTripV2['queuedMovement'] | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (
    typeof value.fromEdgeId !== 'string' ||
    typeof value.toEdgeId !== 'string' ||
    !Number.isSafeInteger(value.arrivedAtTransportSecond) ||
    (value.arrivedAtTransportSecond as number) < 0
  ) {
    return undefined;
  }
  return Object.freeze({
    fromEdgeId: value.fromEdgeId,
    toEdgeId: value.toEdgeId,
    arrivedAtTransportSecond: value.arrivedAtTransportSecond as number,
  });
}

function parseDriveMovementPhase(value: unknown): DriveMovementPhase | null | undefined {
  if (value === null) return null;
  if (
    value === 'WaitingForEntry' ||
    value === 'Entering' ||
    value === 'Travelling' ||
    value === 'Leaving'
  ) {
    return value;
  }
  return undefined;
}

function parseActiveNodeTraversal(value: unknown): ActiveNodeTraversal | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  if (
    typeof value.nodeId !== 'string' ||
    (value.traversalClass !== 'Merge' && value.traversalClass !== 'ConflictJunction') ||
    typeof value.incomingEdgeId !== 'string' ||
    typeof value.outgoingEdgeId !== 'string' ||
    (value.movementKind !== undefined &&
      value.movementKind !== 'Straight' &&
      value.movementKind !== 'Left' &&
      value.movementKind !== 'Right') ||
    !Array.isArray(value.reservedResourceIds) ||
    value.reservedResourceIds.some((id) => typeof id !== 'string') ||
    !Number.isSafeInteger(value.progressQ)
  ) {
    return null;
  }
  return Object.freeze({
    nodeId: value.nodeId,
    traversalClass: value.traversalClass,
    incomingEdgeId: value.incomingEdgeId,
    outgoingEdgeId: value.outgoingEdgeId,
    ...(value.movementKind === undefined ? {} : { movementKind: value.movementKind }),
    reservedResourceIds: Object.freeze([...(value.reservedResourceIds as string[])]),
    progressQ: value.progressQ as number,
  });
}

function validTripV2Fields(value: Record<string, unknown>): boolean {
  return (
    typeof value.tripId === 'string' &&
    typeof value.citizenId === 'string' &&
    (value.mode === 'Walk' || value.mode === 'Drive') &&
    typeof value.originBuildingId === 'string' &&
    typeof value.destinationBuildingId === 'string' &&
    Array.isArray(value.routeEdgeIds) &&
    value.routeEdgeIds.every((edgeId) => typeof edgeId === 'string') &&
    Number.isSafeInteger(value.routeGraphRevision) &&
    Number.isSafeInteger(value.segmentIndex) &&
    Number.isSafeInteger(value.progressQ) &&
    typeof value.lastStableNodeId === 'string' &&
    ['Active', 'Arrived', 'Failed', 'Cancelled'].includes(String(value.status)) &&
    (value.failureReason === null || value.failureReason === 'UnreachableDestination') &&
    Number.isSafeInteger(value.entryServiceCredit) &&
    Array.isArray(value.entryReservationResourceIds) &&
    value.entryReservationResourceIds.every((id) => typeof id === 'string')
  );
}

function validateAgainstGraph(snapshot: TrafficSnapshotV1, graph: TrafficGraph): void {
  if (
    snapshot.graphSourceRoadRevision !== graph.sourceRoadRevision ||
    snapshot.graphSourceBuildingRevision !== graph.sourceBuildingRevision
  ) {
    throw new TrafficContractError('traffic:invalid-source');
  }
  const edgeIds = new Set(graph.edges.map((edge) => edge.edgeId));
  const nodeIds = new Set(graph.nodes.map((node) => node.nodeId));
  for (const trip of snapshot.activeTrips) {
    if (!nodeIds.has(trip.lastStableNodeId)) {
      throw new TrafficContractError('traffic:invalid-trip');
    }
    for (const edgeId of trip.routeEdgeIds) {
      if (!edgeIds.has(edgeId)) throw new TrafficContractError('traffic:invalid-trip');
    }
    if (
      trip.queuedMovement !== null &&
      (!edgeIds.has(trip.queuedMovement.fromEdgeId) || !edgeIds.has(trip.queuedMovement.toEdgeId))
    ) {
      throw new TrafficContractError('traffic:invalid-trip');
    }
  }
}

export function encodeTrafficSaveV1(snapshot: TrafficSnapshotV1): TrafficSaveV1 {
  const canonical = createTrafficSnapshot(snapshot);
  return Object.freeze({
    schemaVersion: TRAFFIC_SCHEMA_VERSION,
    revision: canonical.revision,
    policyVersion: TRAFFIC_POLICY_VERSION,
    graphSourceRoadRevision: canonical.graphSourceRoadRevision,
    graphSourceBuildingRevision: canonical.graphSourceBuildingRevision,
    activeTrips: Object.freeze(
      canonical.activeTrips.map((trip) =>
        Object.freeze({
          ...trip,
          routeEdgeIds: Object.freeze([...trip.routeEdgeIds]),
          queuedMovement:
            trip.queuedMovement === null ? null : Object.freeze({ ...trip.queuedMovement }),
        }),
      ),
    ),
  });
}

export function decodeTrafficSaveV1(
  input: unknown,
  validationGraph: TrafficGraph,
): TrafficSaveDecodeResult {
  const fail = (): TrafficSaveDecodeResult =>
    Object.freeze({ ok: false, error: Object.freeze({ code: 'traffic-save:invalid' }) });
  if (!isRecord(input)) return fail();
  if (
    input.schemaVersion !== TRAFFIC_SCHEMA_VERSION ||
    input.policyVersion !== TRAFFIC_POLICY_VERSION ||
    !Number.isSafeInteger(input.revision) ||
    !Number.isSafeInteger(input.graphSourceRoadRevision) ||
    !Number.isSafeInteger(input.graphSourceBuildingRevision) ||
    !Array.isArray(input.activeTrips)
  ) {
    return fail();
  }
  const activeTrips = input.activeTrips.map(parseTrip);
  if (activeTrips.some((trip) => trip === null)) return fail();
  try {
    const snapshot = createTrafficSnapshot({
      schemaVersion: TRAFFIC_SCHEMA_VERSION,
      revision: input.revision as number,
      policyVersion: TRAFFIC_POLICY_VERSION,
      graphSourceRoadRevision: input.graphSourceRoadRevision as number,
      graphSourceBuildingRevision: input.graphSourceBuildingRevision as number,
      activeTrips: activeTrips as ActiveTransportTrip[],
    });
    validateAgainstGraph(snapshot, validationGraph);
    return Object.freeze({ ok: true, value: snapshot });
  } catch (error) {
    if (error instanceof TrafficContractError) return fail();
    throw error;
  }
}

export function encodeTrafficSaveV2(snapshot: TrafficSnapshotV2): TrafficSaveV2 {
  const canonical = createTrafficSnapshotV2(snapshot);
  return Object.freeze({
    schemaVersion: 2,
    revision: canonical.revision,
    policyVersion: canonical.policyVersion,
    graphSourceRoadRevision: canonical.graphSourceRoadRevision,
    graphSourceBuildingRevision: canonical.graphSourceBuildingRevision,
    timeCursor: canonical.timeCursor,
    activeTrips: Object.freeze(
      canonical.activeTrips.map((trip) =>
        Object.freeze({
          ...trip,
          routeEdgeIds: Object.freeze([...trip.routeEdgeIds]),
          entryReservationResourceIds: Object.freeze([...(trip.entryReservationResourceIds ?? [])]),
          queuedMovement:
            trip.queuedMovement === null ? null : Object.freeze({ ...trip.queuedMovement }),
          ...(trip.activeNodeTraversal === undefined
            ? {}
            : {
                activeNodeTraversal: Object.freeze({
                  ...trip.activeNodeTraversal,
                  reservedResourceIds: Object.freeze([
                    ...trip.activeNodeTraversal.reservedResourceIds,
                  ]),
                }),
              }),
        }),
      ),
    ),
  });
}

export function decodeTrafficSaveV2(
  input: unknown,
  validationGraph: TrafficGraph,
): TrafficSaveV2DecodeResult {
  const fail = (): TrafficSaveV2DecodeResult =>
    Object.freeze({ ok: false, error: Object.freeze({ code: 'traffic-save:invalid' }) });
  if (
    !isRecord(input) ||
    input.schemaVersion !== 2 ||
    input.policyVersion !== TRAFFIC_POLICY_VERSION ||
    !Number.isSafeInteger(input.revision) ||
    !Number.isSafeInteger(input.graphSourceRoadRevision) ||
    !Number.isSafeInteger(input.graphSourceBuildingRevision) ||
    !isRecord(input.timeCursor) ||
    !Array.isArray(input.activeTrips)
  )
    return fail();
  const activeTrips = input.activeTrips.map(parseTripV2);
  if (activeTrips.some((trip) => trip === null)) return fail();
  try {
    const snapshot = createTrafficSnapshotV2({
      schemaVersion: 2,
      revision: input.revision as number,
      policyVersion: 1,
      graphSourceRoadRevision: input.graphSourceRoadRevision as number,
      graphSourceBuildingRevision: input.graphSourceBuildingRevision as number,
      timeCursor: input.timeCursor as unknown as TrafficSnapshotV2['timeCursor'],
      activeTrips: activeTrips as ActiveTransportTripV2[],
    });
    validateAgainstGraph(snapshot as unknown as TrafficSnapshotV1, validationGraph);
    if (hasCanonicalDriveOverlap(snapshot, validationGraph)) return fail();
    return Object.freeze({ ok: true, value: snapshot });
  } catch (error) {
    if (error instanceof TrafficContractError) return fail();
    throw error;
  }
}
