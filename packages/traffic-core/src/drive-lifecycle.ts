import { type ActiveTransportTripV2, type DriveMovementPhase } from './contracts.js';
import { TrafficContractError } from './errors.js';

export function initialDriveMovementPhase(): DriveMovementPhase {
  return 'WaitingForEntry';
}

export function enterDriveMovementPhase(trip: ActiveTransportTripV2): ActiveTransportTripV2 {
  if (
    trip.mode !== 'Drive' ||
    trip.status !== 'Active' ||
    trip.driveMovementPhase !== 'WaitingForEntry'
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  return Object.freeze({ ...trip, driveMovementPhase: 'Entering' });
}

export function beginDriveTravelling(trip: ActiveTransportTripV2): ActiveTransportTripV2 {
  if (trip.mode !== 'Drive' || trip.status !== 'Active' || trip.driveMovementPhase !== 'Entering') {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  return Object.freeze({ ...trip, driveMovementPhase: 'Travelling' });
}

export function beginDriveLeaving(trip: ActiveTransportTripV2): ActiveTransportTripV2 {
  if (
    trip.mode !== 'Drive' ||
    trip.status !== 'Active' ||
    trip.driveMovementPhase !== 'Travelling'
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  return Object.freeze({ ...trip, driveMovementPhase: 'Leaving' });
}

export function arriveLeavingDrive(trip: ActiveTransportTripV2): ActiveTransportTripV2 {
  if (trip.mode !== 'Drive' || trip.status !== 'Active' || trip.driveMovementPhase !== 'Leaving') {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  return Object.freeze({
    ...trip,
    driveMovementPhase: null,
    status: 'Arrived',
    failureReason: null,
    entryServiceCredit: 0,
    entryReservationResourceIds: Object.freeze([]),
  });
}

export function terminateDriveWithEntryReservation(
  trip: ActiveTransportTripV2,
  status: 'Failed' | 'Cancelled',
): ActiveTransportTripV2 {
  if (trip.mode !== 'Drive' || trip.status !== 'Active') {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  return Object.freeze({
    ...trip,
    status,
    failureReason: status === 'Failed' ? 'UnreachableDestination' : null,
    driveMovementPhase: null,
    entryServiceCredit: 0,
    entryReservationResourceIds: Object.freeze([]),
  });
}
