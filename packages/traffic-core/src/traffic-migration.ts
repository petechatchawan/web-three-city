import {
  TRAFFIC_PROGRESS_MAX_Q,
  compareTrafficId,
  type ActiveTransportTrip,
  type ActiveTransportTripV2,
  type TrafficGraph,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import {
  createTrafficSnapshotV2,
  type TrafficSnapshotV1,
  type TrafficSnapshotV2,
} from './traffic-snapshot.js';
import {
  subtractTransportSeconds,
  transportSecondDuration,
  transportSecondValue,
  type AbsoluteTransportSecond,
} from './transport-time.js';

const LEGACY_MIGRATION_HEADWAY_MILLIMETERS = 1_000;

function phaseForLegacyTrip(
  trip: ActiveTransportTrip,
): ActiveTransportTripV2['driveMovementPhase'] {
  return trip.mode === 'Drive' && trip.status === 'Active' ? 'Travelling' : null;
}

function rebaseQueuedMovement(
  queuedMovement: ActiveTransportTrip['queuedMovement'],
  legacyCurrentGameSecond: number,
  currentTransportSecond: AbsoluteTransportSecond,
): ActiveTransportTripV2['queuedMovement'] {
  if (queuedMovement === null) return null;
  const age = legacyCurrentGameSecond - queuedMovement.arrivedAtGameSecond;
  if (!Number.isSafeInteger(age) || age < 0 || age > transportSecondValue(currentTransportSecond)) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return Object.freeze({
    fromEdgeId: queuedMovement.fromEdgeId,
    toEdgeId: queuedMovement.toEdgeId,
    arrivedAtTransportSecond: subtractTransportSeconds(
      currentTransportSecond,
      transportSecondDuration(age),
    ),
  });
}

function migrateTrip(
  trip: ActiveTransportTrip,
  legacyCurrentGameSecond: number,
  currentTransportSecond: AbsoluteTransportSecond,
): ActiveTransportTripV2 {
  return Object.freeze({
    ...trip,
    queuedMovement: rebaseQueuedMovement(
      trip.queuedMovement,
      legacyCurrentGameSecond,
      currentTransportSecond,
    ),
    driveMovementPhase: phaseForLegacyTrip(trip),
    entryServiceCredit: 0,
    entryReservationResourceIds: Object.freeze([]),
  });
}

function resetToWaitingForEntry(
  trip: ActiveTransportTripV2,
  graph: TrafficGraph,
): ActiveTransportTripV2 {
  const firstEdge = graph.edges.find((edge) => edge.edgeId === trip.routeEdgeIds[0]);
  if (firstEdge === undefined) throw new TrafficContractError('traffic:invalid-trip');
  return Object.freeze({
    ...trip,
    segmentIndex: 0,
    progressQ: 0,
    lastStableNodeId: firstEdge.fromNodeId,
    queuedMovement: null,
    driveMovementPhase: 'WaitingForEntry',
    entryServiceCredit: 0,
    entryReservationResourceIds: Object.freeze([]),
  });
}

function requiredHeadwayProgressQ(edgeLengthMillimeters: number): number {
  return Math.ceil(
    (LEGACY_MIGRATION_HEADWAY_MILLIMETERS * TRAFFIC_PROGRESS_MAX_Q) / edgeLengthMillimeters,
  );
}

/** One-time V1 compatibility repair. Current-schema V2 loads must never call this. */
function collectLegacyDriveTripsByEdge(
  trips: readonly ActiveTransportTripV2[],
): Map<string, ActiveTransportTripV2[]> {
  const byEdge = new Map<string, ActiveTransportTripV2[]>();
  for (const trip of trips) {
    if (
      trip.mode !== 'Drive' ||
      trip.status !== 'Active' ||
      trip.driveMovementPhase !== 'Travelling'
    )
      continue;
    const edgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (edgeId === undefined) continue;
    const bucket = byEdge.get(edgeId) ?? [];
    bucket.push(trip);
    byEdge.set(edgeId, bucket);
  }
  return byEdge;
}

function normalizeLegacyDriveBucket(
  bucket: readonly ActiveTransportTripV2[],
  edge: TrafficGraph['edges'][number],
  graph: TrafficGraph,
  normalizedByTripId: Map<string, ActiveTransportTripV2>,
): void {
  const headwayQ = requiredHeadwayProgressQ(edge.lengthQ);
  let leaderProgressQ: number | undefined;
  for (const trip of [...bucket].sort((first, second) =>
    first.progressQ !== second.progressQ
      ? second.progressQ - first.progressQ
      : compareTrafficId(first.tripId, second.tripId),
  )) {
    const allowedProgressQ =
      leaderProgressQ === undefined ? trip.progressQ : leaderProgressQ - headwayQ;
    const normalized =
      allowedProgressQ < 0
        ? resetToWaitingForEntry(trip, graph)
        : Object.freeze({ ...trip, progressQ: Math.min(trip.progressQ, allowedProgressQ) });
    normalizedByTripId.set(trip.tripId, normalized);
    if (allowedProgressQ >= 0) leaderProgressQ = normalized.progressQ;
  }
}

function normalizeLegacyDriveOverlap(
  trips: readonly ActiveTransportTripV2[],
  graph: TrafficGraph,
): readonly ActiveTransportTripV2[] {
  const byEdge = collectLegacyDriveTripsByEdge(trips);
  const normalizedByTripId = new Map<string, ActiveTransportTripV2>();
  for (const [edgeId, bucket] of byEdge) {
    const edge = graph.edges.find((candidate) => candidate.edgeId === edgeId);
    if (edge === undefined || edge.mode !== 'Drive')
      throw new TrafficContractError('traffic:invalid-trip');
    normalizeLegacyDriveBucket(bucket, edge, graph, normalizedByTripId);
  }
  return Object.freeze(trips.map((trip) => normalizedByTripId.get(trip.tripId) ?? trip));
}

export function migrateTrafficSaveV1ToV2(
  input: Readonly<{
    snapshot: TrafficSnapshotV1;
    graph: TrafficGraph;
    legacyCurrentGameSecond: number;
    timeCursor: TrafficSnapshotV2['timeCursor'];
  }>,
): TrafficSnapshotV2 {
  if (!Number.isSafeInteger(input.legacyCurrentGameSecond) || input.legacyCurrentGameSecond < 0) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  const activeTrips = input.snapshot.activeTrips.map((trip) =>
    migrateTrip(trip, input.legacyCurrentGameSecond, input.timeCursor.absoluteTransportSecond),
  );
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: input.snapshot.revision,
    policyVersion: input.snapshot.policyVersion,
    graphSourceRoadRevision: input.snapshot.graphSourceRoadRevision,
    graphSourceBuildingRevision: input.snapshot.graphSourceBuildingRevision,
    timeCursor: input.timeCursor,
    activeTrips: normalizeLegacyDriveOverlap(activeTrips, input.graph),
  });
}

export function hasCanonicalDriveOverlap(
  snapshot: TrafficSnapshotV2,
  graph: TrafficGraph,
): boolean {
  const byEdge = new Map<string, ActiveTransportTripV2[]>();
  for (const trip of snapshot.activeTrips) {
    if (
      trip.mode !== 'Drive' ||
      trip.status !== 'Active' ||
      trip.driveMovementPhase !== 'Travelling'
    )
      continue;
    const edgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (edgeId === undefined) return true;
    const bucket = byEdge.get(edgeId) ?? [];
    bucket.push(trip);
    byEdge.set(edgeId, bucket);
  }
  for (const [edgeId, bucket] of byEdge) {
    const edge = graph.edges.find((candidate) => candidate.edgeId === edgeId);
    if (edge === undefined || edge.mode !== 'Drive') return true;
    const headwayQ = requiredHeadwayProgressQ(edge.lengthQ);
    const ordered = [...bucket].sort((first, second) =>
      first.progressQ !== second.progressQ
        ? second.progressQ - first.progressQ
        : compareTrafficId(first.tripId, second.tripId),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index - 1]!.progressQ - ordered[index]!.progressQ < headwayQ) return true;
    }
  }
  return false;
}
