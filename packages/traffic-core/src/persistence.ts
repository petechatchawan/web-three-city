import {
  TRAFFIC_PROGRESS_MAX_Q,
  type ActiveTransportTrip,
  type TrafficGraph,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import {
  TRAFFIC_POLICY_VERSION,
  TRAFFIC_SCHEMA_VERSION,
  createTrafficSnapshot,
  type TrafficSnapshotV1,
} from './traffic-snapshot.js';

export interface TrafficSaveV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly activeTrips: readonly ActiveTransportTrip[];
}

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
