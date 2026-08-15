import {
  compareMobilityId,
  type CitizenMobilityState,
  type MobilityTrip,
  type PresentCitizenMobilityProjection,
} from './contracts.js';
import { MobilityContractError } from './errors.js';
import { createMobilitySnapshot, type MobilitySnapshotV1 } from './mobility-snapshot.js';

export interface MobilityReconciliationResult {
  readonly snapshot: MobilitySnapshotV1;
  readonly cancelledTripIds: readonly string[];
  readonly destinationRevalidationTripIds: readonly string[];
}

function initialStateFor(citizen: PresentCitizenMobilityProjection): CitizenMobilityState {
  if (citizen.homeBuildingId !== null) {
    return Object.freeze({
      citizenId: citizen.citizenId,
      currentActivity: 'Home',
      stationaryBuildingId: citizen.homeBuildingId,
      activeTripId: null,
      scheduleCursorDay: 0,
      nextBoundaryGameMinute: null,
    });
  }
  if (citizen.workBuildingId !== null) {
    return Object.freeze({
      citizenId: citizen.citizenId,
      currentActivity: 'Work',
      stationaryBuildingId: citizen.workBuildingId,
      activeTripId: null,
      scheduleCursorDay: 0,
      nextBoundaryGameMinute: null,
    });
  }
  return Object.freeze({
    citizenId: citizen.citizenId,
    currentActivity: 'Idle',
    stationaryBuildingId: null,
    activeTripId: null,
    scheduleCursorDay: 0,
    nextBoundaryGameMinute: null,
  });
}

function authoritativeDestination(
  trip: MobilityTrip,
  citizen: PresentCitizenMobilityProjection,
): string | null {
  return trip.purpose === 'CommuteToWork' ? citizen.workBuildingId : citizen.homeBuildingId;
}

export function reconcileMobilityCitizens(input: Readonly<{
  snapshot: MobilitySnapshotV1;
  citizens: readonly PresentCitizenMobilityProjection[];
}>): MobilityReconciliationResult {
  const snapshot = createMobilitySnapshot(input.snapshot);
  const projectionById = new Map(input.citizens.map((citizen) => [citizen.citizenId, citizen] as const));
  const tripById = new Map(snapshot.trips.map((trip) => [trip.tripId, trip] as const));
  const cancelledTripIds: string[] = [];
  const destinationRevalidationTripIds: string[] = [];
  const nextStates: CitizenMobilityState[] = [];
  const cancelled = new Set<string>();

  for (const state of snapshot.citizenStates) {
    const citizen = projectionById.get(state.citizenId);
    if (citizen === undefined || !citizen.present) {
      if (state.activeTripId !== null) {
        cancelledTripIds.push(state.activeTripId);
        cancelled.add(state.activeTripId);
      }
      continue;
    }

    if (state.currentActivity === 'Travel' && state.activeTripId !== null) {
      const trip = tripById.get(state.activeTripId);
      if (trip === undefined) throw new MobilityContractError('mobility:missing-active-trip');
      const latestDestination = authoritativeDestination(trip, citizen);
      if (latestDestination === null || latestDestination !== trip.destinationBuildingId) {
        destinationRevalidationTripIds.push(trip.tripId);
      }
      nextStates.push(state);
      continue;
    }

    if (state.currentActivity === 'Home') {
      if (citizen.homeBuildingId !== null) {
        nextStates.push(Object.freeze({ ...state, stationaryBuildingId: citizen.homeBuildingId }));
      } else {
        nextStates.push(
          Object.freeze({
            ...state,
            currentActivity: 'Idle',
            stationaryBuildingId: citizen.workBuildingId,
          }),
        );
      }
      continue;
    }

    if (state.currentActivity === 'Work') {
      if (citizen.workBuildingId !== null) {
        nextStates.push(Object.freeze({ ...state, stationaryBuildingId: citizen.workBuildingId }));
      } else {
        nextStates.push(
          Object.freeze({
            ...state,
            currentActivity: citizen.homeBuildingId === null ? 'Idle' : 'Home',
            stationaryBuildingId: citizen.homeBuildingId,
          }),
        );
      }
      continue;
    }

    nextStates.push(
      state.stationaryBuildingId !== null
        ? state
        : Object.freeze({
            ...state,
            stationaryBuildingId: citizen.homeBuildingId ?? citizen.workBuildingId,
          }),
    );
  }

  const existingIds = new Set(nextStates.map((state) => state.citizenId));
  for (const citizen of input.citizens) {
    if (!citizen.present || existingIds.has(citizen.citizenId)) continue;
    nextStates.push(initialStateFor(citizen));
  }

  const nextTrips = snapshot.trips.map((trip) =>
    cancelled.has(trip.tripId) && trip.status === 'Active'
      ? Object.freeze({ ...trip, status: 'Cancelled' as const, failureReason: null })
      : trip,
  );
  nextStates.sort((first, second) => compareMobilityId(first.citizenId, second.citizenId));
  cancelledTripIds.sort(compareMobilityId);
  destinationRevalidationTripIds.sort(compareMobilityId);

  const changed =
    JSON.stringify(nextStates) !== JSON.stringify(snapshot.citizenStates) ||
    cancelled.size > 0;
  const nextSnapshot = changed
    ? createMobilitySnapshot({
        ...snapshot,
        revision: snapshot.revision + 1,
        citizenStates: nextStates,
        trips: nextTrips,
      })
    : snapshot;

  return Object.freeze({
    snapshot: nextSnapshot,
    cancelledTripIds: Object.freeze(cancelledTripIds),
    destinationRevalidationTripIds: Object.freeze(destinationRevalidationTripIds),
  });
}

export function settleMobilityTrip(input: Readonly<{
  snapshot: MobilitySnapshotV1;
  tripId: string;
  outcome: 'Arrived' | 'Failed' | 'Cancelled';
  fallbackBuildingId?: string | null;
}>): MobilitySnapshotV1 {
  const snapshot = createMobilitySnapshot(input.snapshot);
  const trip = snapshot.trips.find((entry) => entry.tripId === input.tripId);
  if (trip === undefined || trip.status !== 'Active') {
    throw new MobilityContractError('mobility:invalid-trip');
  }
  const state = snapshot.citizenStates.find((entry) => entry.citizenId === trip.citizenId);
  if (state === undefined || state.activeTripId !== trip.tripId) {
    throw new MobilityContractError('mobility:active-trip-citizen-mismatch');
  }

  const arrived = input.outcome === 'Arrived';
  const stationaryBuildingId = arrived
    ? trip.destinationBuildingId
    : input.fallbackBuildingId ?? trip.originBuildingId;
  const nextActivity = arrived
    ? trip.purpose === 'CommuteToWork'
      ? ('Work' as const)
      : ('Home' as const)
    : ('Idle' as const);
  const nextState: CitizenMobilityState = Object.freeze({
    ...state,
    currentActivity: nextActivity,
    stationaryBuildingId,
    activeTripId: null,
  });
  const nextTrip: MobilityTrip = Object.freeze({
    ...trip,
    status: input.outcome,
    failureReason: input.outcome === 'Failed' ? 'Unreachable' : null,
  });

  return createMobilitySnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    citizenStates: snapshot.citizenStates.map((entry) =>
      entry.citizenId === state.citizenId ? nextState : entry,
    ),
    trips: snapshot.trips.map((entry) => (entry.tripId === trip.tripId ? nextTrip : entry)),
  });
}
