import {
  compareMobilityId,
  validateCitizenMobilityState,
  validateMobilityTrip,
  type CitizenMobilityState,
  type MobilityTrip,
} from './contracts.js';
import { MobilityContractError } from './errors.js';
import { absoluteGameMinute, gameMinuteValue } from '@web-three-city/simulation-core';

export const MOBILITY_SCHEMA_VERSION = 1 as const;
export const MOBILITY_POLICY_VERSION = 1 as const;
export const MOBILITY_SCHEDULE_SEED_VERSION = 1 as const;

const CANONICAL_MOBILITY_SNAPSHOTS = new WeakSet<object>();

export interface MobilitySnapshotV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly scheduleSeedVersion: 1;
  readonly nextTripSequence: number;
  readonly citizenStates: readonly CitizenMobilityState[];
  readonly trips: readonly MobilityTrip[];
}

function cloneState(state: CitizenMobilityState): CitizenMobilityState {
  validateCitizenMobilityState(state);
  return Object.freeze({
    ...state,
    nextBoundaryGameMinute:
      state.nextBoundaryGameMinute === null
        ? null
        : absoluteGameMinute(gameMinuteValue(state.nextBoundaryGameMinute)),
  });
}

function cloneTrip(trip: MobilityTrip): MobilityTrip {
  validateMobilityTrip(trip);
  return Object.freeze({
    ...trip,
    departureGameMinute: absoluteGameMinute(gameMinuteValue(trip.departureGameMinute)),
  });
}

function assertSnapshotHeader(input: MobilitySnapshotV1): void {
  if (input.schemaVersion !== MOBILITY_SCHEMA_VERSION) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  if (input.policyVersion !== MOBILITY_POLICY_VERSION) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  if (input.scheduleSeedVersion !== MOBILITY_SCHEDULE_SEED_VERSION) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  if (!Number.isSafeInteger(input.nextTripSequence) || input.nextTripSequence < 1) {
    throw new MobilityContractError('mobility:invalid-sequence');
  }
}

export function createMobilitySnapshot(input: MobilitySnapshotV1): MobilitySnapshotV1 {
  if (CANONICAL_MOBILITY_SNAPSHOTS.has(input)) return input;
  assertSnapshotHeader(input);

  const citizenStates = input.citizenStates
    .map(cloneState)
    .sort((first, second) => compareMobilityId(first.citizenId, second.citizenId));
  const trips = input.trips
    .map(cloneTrip)
    .sort((first, second) => compareMobilityId(first.tripId, second.tripId));

  for (let index = 1; index < citizenStates.length; index += 1) {
    if (citizenStates[index - 1]!.citizenId === citizenStates[index]!.citizenId) {
      throw new MobilityContractError('mobility:duplicate-citizen');
    }
  }
  for (let index = 1; index < trips.length; index += 1) {
    if (trips[index - 1]!.tripId === trips[index]!.tripId) {
      throw new MobilityContractError('mobility:duplicate-trip');
    }
  }

  const tripById = new Map(trips.map((trip) => [trip.tripId, trip] as const));
  const activeTripIds = new Set<string>();
  for (const state of citizenStates) {
    if (state.activeTripId === null) continue;
    const trip = tripById.get(state.activeTripId);
    if (trip === undefined) {
      throw new MobilityContractError('mobility:missing-active-trip');
    }
    if (trip.citizenId !== state.citizenId) {
      throw new MobilityContractError('mobility:active-trip-citizen-mismatch');
    }
    if (trip.status !== 'Active') {
      throw new MobilityContractError('mobility:invalid-trip');
    }
    if (activeTripIds.has(trip.tripId)) {
      throw new MobilityContractError('mobility:invalid-trip');
    }
    activeTripIds.add(trip.tripId);
  }

  for (const trip of trips) {
    if (trip.status === 'Active' && !activeTripIds.has(trip.tripId)) {
      throw new MobilityContractError('mobility:missing-active-trip');
    }
  }

  const snapshot = Object.freeze({
    schemaVersion: MOBILITY_SCHEMA_VERSION,
    revision: input.revision,
    policyVersion: MOBILITY_POLICY_VERSION,
    scheduleSeedVersion: MOBILITY_SCHEDULE_SEED_VERSION,
    nextTripSequence: input.nextTripSequence,
    citizenStates: Object.freeze(citizenStates),
    trips: Object.freeze(trips),
  });
  CANONICAL_MOBILITY_SNAPSHOTS.add(snapshot);
  return snapshot;
}

export function createEmptyMobilitySnapshot(): MobilitySnapshotV1 {
  return createMobilitySnapshot({
    schemaVersion: MOBILITY_SCHEMA_VERSION,
    revision: 0,
    policyVersion: MOBILITY_POLICY_VERSION,
    scheduleSeedVersion: MOBILITY_SCHEDULE_SEED_VERSION,
    nextTripSequence: 1,
    citizenStates: [],
    trips: [],
  });
}
