import {
  compareTrafficId,
  validateActiveTransportTrip,
  validateActiveTransportTripV2,
  type ActiveTransportTrip,
  type ActiveTransportTripV2,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import { initialDriveMovementPhase } from './drive-lifecycle.js';
import { createTrafficTimeCursor, type TrafficTimeCursor } from './transport-time.js';

export const TRAFFIC_SCHEMA_VERSION = 1 as const;
export const TRAFFIC_POLICY_VERSION = 1 as const;

const CANONICAL_TRAFFIC_V2_SNAPSHOTS = new WeakSet<object>();

export interface TrafficSnapshotV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly activeTrips: readonly ActiveTransportTrip[];
}

export interface TrafficSnapshotV2 {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly timeCursor: TrafficTimeCursor;
  readonly activeTrips: readonly ActiveTransportTripV2[];
}

export function createTrafficSnapshot(input: TrafficSnapshotV1): TrafficSnapshotV1 {
  if (
    input.schemaVersion !== TRAFFIC_SCHEMA_VERSION ||
    input.policyVersion !== TRAFFIC_POLICY_VERSION
  ) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    !Number.isSafeInteger(input.graphSourceRoadRevision) ||
    input.graphSourceRoadRevision < 0 ||
    !Number.isSafeInteger(input.graphSourceBuildingRevision) ||
    input.graphSourceBuildingRevision < 0
  ) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  const activeTrips = input.activeTrips
    .map((trip) => {
      validateActiveTransportTrip(trip);
      return Object.freeze({
        ...trip,
        routeEdgeIds: Object.freeze([...trip.routeEdgeIds]),
        queuedMovement:
          trip.queuedMovement === null ? null : Object.freeze({ ...trip.queuedMovement }),
      });
    })
    .sort((first, second) => compareTrafficId(first.tripId, second.tripId));
  for (let index = 1; index < activeTrips.length; index += 1) {
    if (activeTrips[index - 1]!.tripId === activeTrips[index]!.tripId) {
      throw new TrafficContractError('traffic:duplicate-trip');
    }
  }
  return Object.freeze({
    schemaVersion: TRAFFIC_SCHEMA_VERSION,
    revision: input.revision,
    policyVersion: TRAFFIC_POLICY_VERSION,
    graphSourceRoadRevision: input.graphSourceRoadRevision,
    graphSourceBuildingRevision: input.graphSourceBuildingRevision,
    activeTrips: Object.freeze(activeTrips),
  });
}

export function createEmptyTrafficSnapshot(
  input: Readonly<{
    roadRevision?: number;
    buildingRevision?: number;
  }> = {},
): TrafficSnapshotV1 {
  return createTrafficSnapshot({
    schemaVersion: TRAFFIC_SCHEMA_VERSION,
    revision: 0,
    policyVersion: TRAFFIC_POLICY_VERSION,
    graphSourceRoadRevision: input.roadRevision ?? 0,
    graphSourceBuildingRevision: input.buildingRevision ?? 0,
    activeTrips: [],
  });
}

export function createTrafficSnapshotV2(input: TrafficSnapshotV2): TrafficSnapshotV2 {
  if (CANONICAL_TRAFFIC_V2_SNAPSHOTS.has(input)) return input;
  if (input.schemaVersion !== 2 || input.policyVersion !== TRAFFIC_POLICY_VERSION) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    !Number.isSafeInteger(input.graphSourceRoadRevision) ||
    input.graphSourceRoadRevision < 0 ||
    !Number.isSafeInteger(input.graphSourceBuildingRevision) ||
    input.graphSourceBuildingRevision < 0
  ) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  const timeCursor = createTrafficTimeCursor(input.timeCursor);
  const activeTrips = input.activeTrips
    .map((trip) => {
      const normalizedTrip: ActiveTransportTripV2 = {
        ...trip,
        driveMovementPhase:
          trip.mode === 'Drive'
            ? (trip.driveMovementPhase ??
              (trip.status === 'Active' ? initialDriveMovementPhase() : null))
            : null,
        entryServiceCredit:
          trip.mode === 'Drive' && trip.status === 'Active' ? (trip.entryServiceCredit ?? 0) : 0,
        entryReservationResourceIds:
          trip.mode === 'Drive' && trip.status === 'Active'
            ? (trip.entryReservationResourceIds ?? [])
            : [],
      };
      validateActiveTransportTripV2(normalizedTrip);
      return Object.freeze({
        ...normalizedTrip,
        routeEdgeIds: Object.freeze([...normalizedTrip.routeEdgeIds]),
        entryReservationResourceIds: Object.freeze([
          ...normalizedTrip.entryReservationResourceIds!,
        ]),
        ...(normalizedTrip.activeNodeTraversal === undefined
          ? {}
          : {
              activeNodeTraversal: Object.freeze({
                ...normalizedTrip.activeNodeTraversal,
                reservedResourceIds: Object.freeze([
                  ...normalizedTrip.activeNodeTraversal.reservedResourceIds,
                ]),
              }),
            }),
        queuedMovement:
          normalizedTrip.queuedMovement === null
            ? null
            : Object.freeze({ ...normalizedTrip.queuedMovement }),
      });
    })
    .sort((first, second) => compareTrafficId(first.tripId, second.tripId));
  for (let index = 1; index < activeTrips.length; index += 1) {
    if (activeTrips[index - 1]!.tripId === activeTrips[index]!.tripId) {
      throw new TrafficContractError('traffic:duplicate-trip');
    }
  }
  const snapshot = Object.freeze({
    schemaVersion: 2,
    revision: input.revision,
    policyVersion: TRAFFIC_POLICY_VERSION,
    graphSourceRoadRevision: input.graphSourceRoadRevision,
    graphSourceBuildingRevision: input.graphSourceBuildingRevision,
    timeCursor,
    activeTrips: Object.freeze(activeTrips),
  });
  CANONICAL_TRAFFIC_V2_SNAPSHOTS.add(snapshot);
  return snapshot;
}
