import { createMobilitySnapshot, type MobilitySnapshotV1 } from './mobility-snapshot.js';

export function fingerprintMobilitySnapshot(snapshot: MobilitySnapshotV1): string {
  const canonical = createMobilitySnapshot(snapshot);
  return JSON.stringify({
    schemaVersion: canonical.schemaVersion,
    revision: canonical.revision,
    policyVersion: canonical.policyVersion,
    scheduleSeedVersion: canonical.scheduleSeedVersion,
    nextTripSequence: canonical.nextTripSequence,
    citizenStates: canonical.citizenStates.map((state) => [
      state.citizenId,
      state.currentActivity,
      state.stationaryBuildingId,
      state.activeTripId,
      state.scheduleCursorDay,
      state.nextBoundaryGameMinute,
    ]),
    trips: canonical.trips.map((trip) => [
      trip.tripId,
      trip.citizenId,
      trip.purpose,
      trip.originBuildingId,
      trip.destinationBuildingId,
      trip.mode,
      trip.departureGameMinute,
      trip.status,
      trip.failureReason,
    ]),
  });
}
