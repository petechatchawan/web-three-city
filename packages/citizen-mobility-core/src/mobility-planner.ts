import {
  assertMobilityId,
  compareMobilityId,
  type MobilityTripPlanningRequest,
  type PresentCitizenMobilityProjection,
} from './contracts.js';
import { MobilityContractError } from './errors.js';
import { createMobilitySnapshot, type MobilitySnapshotV1 } from './mobility-snapshot.js';
import type { DueMobilityBoundary } from './schedule-policy.js';

export interface MobilityPlanResult {
  readonly baseRevision: number;
  readonly proposedSnapshot: MobilitySnapshotV1;
  readonly planningRequests: readonly MobilityTripPlanningRequest[];
  readonly skipped: readonly Readonly<{
    citizenId: string;
    reason: 'OriginUnavailable' | 'DestinationUnavailable';
  }>[];
}

export function formatMobilityTripId(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new MobilityContractError('mobility:invalid-sequence');
  }
  return `mobility-trip-${String(sequence).padStart(10, '0')}`;
}

export function planMobilityBoundaries(input: Readonly<{
  snapshot: MobilitySnapshotV1;
  boundaries: readonly DueMobilityBoundary[];
  citizens: readonly PresentCitizenMobilityProjection[];
}>): MobilityPlanResult {
  const snapshot = createMobilitySnapshot(input.snapshot);
  const citizenById = new Map(input.citizens.map((citizen) => [citizen.citizenId, citizen] as const));
  const stateByCitizenId = new Map(snapshot.citizenStates.map((state) => [state.citizenId, state] as const));
  const sortedBoundaries = [...input.boundaries].sort((first, second) =>
    first.atGameMinute !== second.atGameMinute
      ? first.atGameMinute - second.atGameMinute
      : first.nextActivity !== second.nextActivity
        ? first.nextActivity === 'Work'
          ? -1
          : 1
        : compareMobilityId(first.citizenId, second.citizenId),
  );
  const planningRequests: MobilityTripPlanningRequest[] = [];
  const skipped: { citizenId: string; reason: 'OriginUnavailable' | 'DestinationUnavailable' }[] = [];
  const requestedCitizens = new Set<string>();

  for (const boundary of sortedBoundaries) {
    assertMobilityId(boundary.citizenId);
    const citizen = citizenById.get(boundary.citizenId);
    const state = stateByCitizenId.get(boundary.citizenId);
    if (citizen === undefined || !citizen.present || state === undefined) continue;
    if (state.activeTripId !== null || requestedCitizens.has(boundary.citizenId)) continue;

    const originBuildingId =
      boundary.nextActivity === 'Work' ? citizen.homeBuildingId : citizen.workBuildingId;
    const destinationBuildingId =
      boundary.nextActivity === 'Work' ? citizen.workBuildingId : citizen.homeBuildingId;
    if (originBuildingId === null) {
      skipped.push({ citizenId: citizen.citizenId, reason: 'OriginUnavailable' });
      continue;
    }
    if (destinationBuildingId === null) {
      skipped.push({ citizenId: citizen.citizenId, reason: 'DestinationUnavailable' });
      continue;
    }
    if (originBuildingId === destinationBuildingId) {
      skipped.push({ citizenId: citizen.citizenId, reason: 'DestinationUnavailable' });
      continue;
    }

    const tripSequence = snapshot.nextTripSequence + planningRequests.length;
    planningRequests.push(
      Object.freeze({
        tripId: formatMobilityTripId(tripSequence),
        citizenId: citizen.citizenId,
        purpose: boundary.nextActivity === 'Work' ? 'CommuteToWork' : 'CommuteHome',
        originBuildingId,
        destinationBuildingId,
        departureGameMinute: boundary.atGameMinute,
      }),
    );
    requestedCitizens.add(boundary.citizenId);
  }

  return Object.freeze({
    baseRevision: snapshot.revision,
    proposedSnapshot: snapshot,
    planningRequests: Object.freeze(planningRequests),
    skipped: Object.freeze(skipped.map((entry) => Object.freeze({ ...entry }))),
  });
}
