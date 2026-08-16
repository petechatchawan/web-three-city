import {
  compareTrafficId,
  validateActiveTransportTrip,
  type ActiveTransportTrip,
} from './contracts.js';
import { TrafficContractError } from './errors.js';

export const TRAFFIC_SCHEMA_VERSION = 1 as const;
export const TRAFFIC_POLICY_VERSION = 1 as const;

export interface TrafficSnapshotV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly activeTrips: readonly ActiveTransportTrip[];
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
