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

type MobilitySkipReason = 'OriginUnavailable' | 'DestinationUnavailable';

type ResolvedTripEndpoints =
  | Readonly<{ ok: true; originBuildingId: string; destinationBuildingId: string }>
  | Readonly<{ ok: false; reason: MobilitySkipReason }>;

function compareDueMobilityBoundaries(
  first: DueMobilityBoundary,
  second: DueMobilityBoundary,
): number {
  if (first.atGameMinute !== second.atGameMinute) {
    return first.atGameMinute - second.atGameMinute;
  }
  if (first.nextActivity !== second.nextActivity) {
    return first.nextActivity === 'Work' ? -1 : 1;
  }
  return compareMobilityId(first.citizenId, second.citizenId);
}

function resolveTripEndpoints(
  boundary: DueMobilityBoundary,
  citizen: PresentCitizenMobilityProjection,
): ResolvedTripEndpoints {
  const originBuildingId =
    boundary.nextActivity === 'Work' ? citizen.homeBuildingId : citizen.workBuildingId;
  const destinationBuildingId =
    boundary.nextActivity === 'Work' ? citizen.workBuildingId : citizen.homeBuildingId;
  if (originBuildingId === null) {
    return Object.freeze({ ok: false, reason: 'OriginUnavailable' });
  }
  if (destinationBuildingId === null || originBuildingId === destinationBuildingId) {
    return Object.freeze({ ok: false, reason: 'DestinationUnavailable' });
  }
  return Object.freeze({ ok: true, originBuildingId, destinationBuildingId });
}

export function formatMobilityTripId(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new MobilityContractError('mobility:invalid-sequence');
  }
  return `mobility-trip-${String(sequence).padStart(10, '0')}`;
}

export function planMobilityBoundaries(
  input: Readonly<{
    snapshot: MobilitySnapshotV1;
    boundaries: readonly DueMobilityBoundary[];
    citizens: readonly PresentCitizenMobilityProjection[];
  }>,
): MobilityPlanResult {
  const snapshot = createMobilitySnapshot(input.snapshot);
  const citizenById = new Map(
    input.citizens.map((citizen) => [citizen.citizenId, citizen] as const),
  );
  const stateByCitizenId = new Map(
    snapshot.citizenStates.map((state) => [state.citizenId, state] as const),
  );
  const sortedBoundaries = [...input.boundaries].sort(compareDueMobilityBoundaries);
  const planningRequests: MobilityTripPlanningRequest[] = [];
  const skipped: { citizenId: string; reason: MobilitySkipReason }[] = [];
  const requestedCitizens = new Set<string>();

  for (const boundary of sortedBoundaries) {
    assertMobilityId(boundary.citizenId);
    const citizen = citizenById.get(boundary.citizenId);
    const state = stateByCitizenId.get(boundary.citizenId);
    if (citizen === undefined || !citizen.present || state === undefined) continue;
    if (state.activeTripId !== null || requestedCitizens.has(boundary.citizenId)) continue;

    const endpoints = resolveTripEndpoints(boundary, citizen);
    if (!endpoints.ok) {
      skipped.push({ citizenId: citizen.citizenId, reason: endpoints.reason });
      continue;
    }

    const tripSequence = snapshot.nextTripSequence + planningRequests.length;
    planningRequests.push(
      Object.freeze({
        tripId: formatMobilityTripId(tripSequence),
        citizenId: citizen.citizenId,
        purpose: boundary.nextActivity === 'Work' ? 'CommuteToWork' : 'CommuteHome',
        originBuildingId: endpoints.originBuildingId,
        destinationBuildingId: endpoints.destinationBuildingId,
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
