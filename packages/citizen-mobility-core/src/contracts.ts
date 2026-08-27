import { MobilityContractError } from './errors.js';
import { absoluteGameMinute, type AbsoluteGameMinute } from '@web-three-city/simulation-core';

export type MobilityTripId = string;
export type MobilityActivityKind = 'Home' | 'Work' | 'Idle' | 'Travel';
export type MobilityTripMode = 'Walk' | 'Drive';
export type MobilityTripPurpose = 'CommuteToWork' | 'CommuteHome';
export type MobilityTripStatus = 'Planned' | 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
export type MobilityTripFailureReason =
  'Unreachable' | 'OriginUnavailable' | 'DestinationUnavailable';

export interface CitizenMobilityState {
  readonly citizenId: string;
  readonly currentActivity: MobilityActivityKind;
  readonly stationaryBuildingId: string | null;
  readonly activeTripId: MobilityTripId | null;
  readonly scheduleCursorCycle: number;
  readonly nextBoundaryGameMinute: AbsoluteGameMinute | null;
}

export interface MobilityTrip {
  readonly tripId: MobilityTripId;
  readonly citizenId: string;
  readonly purpose: MobilityTripPurpose;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly mode: MobilityTripMode | null;
  readonly departureGameMinute: AbsoluteGameMinute;
  readonly status: MobilityTripStatus;
  readonly failureReason: MobilityTripFailureReason | null;
}

export interface MobilityModeCandidate {
  readonly mode: MobilityTripMode;
  readonly available: boolean;
  readonly generalizedCostSeconds: number | null;
}

export interface MobilityTripPlanningRequest {
  readonly tripId: MobilityTripId;
  readonly citizenId: string;
  readonly purpose: MobilityTripPurpose;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly departureGameMinute: AbsoluteGameMinute;
}

export interface PresentCitizenMobilityProjection {
  readonly citizenId: string;
  readonly homeBuildingId: string | null;
  readonly workBuildingId: string | null;
  readonly present: boolean;
}

export function compareMobilityId(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

export function assertMobilityId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim().length === 0) {
    throw new MobilityContractError('mobility:invalid-id');
  }
}

export function assertNonNegativeSafeInteger(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new MobilityContractError('mobility:invalid-time');
  }
}

function assertAbsoluteGameMinute(value: unknown): asserts value is AbsoluteGameMinute {
  if (typeof value !== 'number') {
    throw new MobilityContractError('mobility:invalid-time');
  }
  try {
    absoluteGameMinute(value);
  } catch {
    throw new MobilityContractError('mobility:invalid-time');
  }
}

export function validateCitizenMobilityState(state: CitizenMobilityState): void {
  assertMobilityId(state.citizenId);
  assertNonNegativeSafeInteger(state.scheduleCursorCycle);
  if (state.nextBoundaryGameMinute !== null) assertAbsoluteGameMinute(state.nextBoundaryGameMinute);
  if (state.stationaryBuildingId !== null) assertMobilityId(state.stationaryBuildingId);
  if (state.activeTripId !== null) assertMobilityId(state.activeTripId);

  if (state.currentActivity === 'Travel') {
    if (state.activeTripId === null) {
      throw new MobilityContractError('mobility:travel-without-active-trip');
    }
    if (state.stationaryBuildingId !== null) {
      throw new MobilityContractError('mobility:invalid-state');
    }
    return;
  }

  if (state.activeTripId !== null) {
    throw new MobilityContractError('mobility:stationary-with-active-trip');
  }

  if (
    (state.currentActivity === 'Home' || state.currentActivity === 'Work') &&
    state.stationaryBuildingId === null
  ) {
    throw new MobilityContractError('mobility:missing-stationary-building');
  }
}

export function validateMobilityTrip(trip: MobilityTrip): void {
  assertMobilityId(trip.tripId);
  assertMobilityId(trip.citizenId);
  assertMobilityId(trip.originBuildingId);
  assertMobilityId(trip.destinationBuildingId);
  assertAbsoluteGameMinute(trip.departureGameMinute);

  if (trip.originBuildingId === trip.destinationBuildingId) {
    throw new MobilityContractError('mobility:invalid-trip');
  }

  if (trip.status === 'Active' || trip.status === 'Arrived') {
    if (trip.mode === null) throw new MobilityContractError('mobility:invalid-trip');
  }
  if (trip.status === 'Failed') {
    if (trip.failureReason === null) throw new MobilityContractError('mobility:invalid-trip');
  } else if (trip.failureReason !== null) {
    throw new MobilityContractError('mobility:invalid-trip');
  }
}

export function validateMobilityModeCandidate(candidate: MobilityModeCandidate): void {
  if (candidate.generalizedCostSeconds !== null) {
    assertNonNegativeSafeInteger(candidate.generalizedCostSeconds);
  }
  if (candidate.available && candidate.generalizedCostSeconds === null) {
    throw new MobilityContractError('mobility:invalid-trip');
  }
  if (!candidate.available && candidate.generalizedCostSeconds !== null) {
    throw new MobilityContractError('mobility:invalid-trip');
  }
}
