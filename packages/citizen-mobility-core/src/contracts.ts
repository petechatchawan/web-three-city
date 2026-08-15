import { MobilityContractError } from './errors.js';

export type MobilityTripId = string;
export type MobilityActivityKind = 'Home' | 'Work' | 'Idle' | 'Travel';
export type MobilityTripMode = 'Walk' | 'Drive';
export type MobilityTripPurpose = 'CommuteToWork' | 'CommuteHome';
export type MobilityTripStatus = 'Planned' | 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
export type MobilityTripFailureReason =
  | 'Unreachable'
  | 'OriginUnavailable'
  | 'DestinationUnavailable';

export interface CitizenMobilityState {
  readonly citizenId: string;
  readonly currentActivity: MobilityActivityKind;
  readonly stationaryBuildingId: string | null;
  readonly activeTripId: MobilityTripId | null;
  readonly scheduleCursorDay: number;
  readonly nextBoundaryGameMinute: number | null;
}

export interface MobilityTrip {
  readonly tripId: MobilityTripId;
  readonly citizenId: string;
  readonly purpose: MobilityTripPurpose;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly mode: MobilityTripMode;
  readonly departureGameMinute: number;
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
  readonly departureGameMinute: number;
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

export function validateCitizenMobilityState(state: CitizenMobilityState): void {
  assertMobilityId(state.citizenId);
  assertNonNegativeSafeInteger(state.scheduleCursorDay);
  if (state.nextBoundaryGameMinute !== null) {
    assertNonNegativeSafeInteger(state.nextBoundaryGameMinute);
  }
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

  if ((state.currentActivity === 'Home' || state.currentActivity === 'Work') && state.stationaryBuildingId === null) {
    throw new MobilityContractError('mobility:missing-stationary-building');
  }
}

export function validateMobilityTrip(trip: MobilityTrip): void {
  assertMobilityId(trip.tripId);
  assertMobilityId(trip.citizenId);
  assertMobilityId(trip.originBuildingId);
  assertMobilityId(trip.destinationBuildingId);
  assertNonNegativeSafeInteger(trip.departureGameMinute);

  if (trip.originBuildingId === trip.destinationBuildingId) {
    throw new MobilityContractError('mobility:invalid-trip');
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
