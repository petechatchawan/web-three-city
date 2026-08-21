import {
  assertMobilityId,
  compareMobilityId,
  type CitizenMobilityState,
  type MobilityTripPlanningRequest,
  type PresentCitizenMobilityProjection,
} from './contracts.js';
import { MobilityContractError } from './errors.js';
import { createMobilitySnapshot, type MobilitySnapshotV1 } from './mobility-snapshot.js';
import { deriveCitizenScheduleForDay, type DueMobilityBoundary } from './schedule-policy.js';

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

function desiredActivityAtGameMinute(
  citizen: PresentCitizenMobilityProjection,
  currentGameMinute: number,
): DueMobilityBoundary['nextActivity'] {
  const dayIndex = Math.floor(currentGameMinute / 1440);
  let desiredActivity: DueMobilityBoundary['nextActivity'] = 'Home';
  for (const boundary of deriveCitizenScheduleForDay(citizen, dayIndex)) {
    if (boundary.atGameMinute > currentGameMinute) break;
    desiredActivity = boundary.nextActivity;
  }
  return desiredActivity;
}

function resolveCatchUpEndpoints(
  desiredActivity: DueMobilityBoundary['nextActivity'],
  state: CitizenMobilityState,
  citizen: PresentCitizenMobilityProjection,
): ResolvedTripEndpoints {
  const destinationBuildingId =
    desiredActivity === 'Work' ? citizen.workBuildingId : citizen.homeBuildingId;
  if (state.stationaryBuildingId === null) {
    return Object.freeze({ ok: false, reason: 'OriginUnavailable' });
  }
  if (destinationBuildingId === null || destinationBuildingId === state.stationaryBuildingId) {
    return Object.freeze({ ok: false, reason: 'DestinationUnavailable' });
  }
  return Object.freeze({
    ok: true,
    originBuildingId: state.stationaryBuildingId,
    destinationBuildingId,
  });
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
    const desiredBuildingId =
      boundary.nextActivity === 'Work' ? citizen.workBuildingId : citizen.homeBuildingId;
    if (state.stationaryBuildingId !== null && state.stationaryBuildingId === desiredBuildingId) {
      continue;
    }

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

export function planMobilityCatchUp(
  input: Readonly<{
    snapshot: MobilitySnapshotV1;
    citizens: readonly PresentCitizenMobilityProjection[];
    currentGameMinute: number;
  }>,
): MobilityPlanResult {
  if (!Number.isSafeInteger(input.currentGameMinute) || input.currentGameMinute < 0) {
    throw new MobilityContractError('mobility:invalid-time');
  }
  const snapshot = createMobilitySnapshot(input.snapshot);
  const citizenById = new Map(
    input.citizens.map((citizen) => [citizen.citizenId, citizen] as const),
  );
  const planningRequests: MobilityTripPlanningRequest[] = [];
  const skipped: { citizenId: string; reason: MobilitySkipReason }[] = [];

  for (const state of snapshot.citizenStates) {
    const citizen = citizenById.get(state.citizenId);
    if (citizen === undefined || !citizen.present || state.activeTripId !== null) continue;

    const desiredActivity = desiredActivityAtGameMinute(citizen, input.currentGameMinute);
    const desiredBuildingId =
      desiredActivity === 'Work' ? citizen.workBuildingId : citizen.homeBuildingId;
    if (desiredBuildingId !== null && desiredBuildingId === state.stationaryBuildingId) continue;
    const endpoints = resolveCatchUpEndpoints(desiredActivity, state, citizen);
    if (!endpoints.ok) {
      skipped.push({ citizenId: citizen.citizenId, reason: endpoints.reason });
      continue;
    }

    planningRequests.push(
      Object.freeze({
        tripId: formatMobilityTripId(snapshot.nextTripSequence + planningRequests.length),
        citizenId: citizen.citizenId,
        purpose: desiredActivity === 'Work' ? 'CommuteToWork' : 'CommuteHome',
        originBuildingId: endpoints.originBuildingId,
        destinationBuildingId: endpoints.destinationBuildingId,
        departureGameMinute: input.currentGameMinute,
      }),
    );
  }

  return Object.freeze({
    baseRevision: snapshot.revision,
    proposedSnapshot: snapshot,
    planningRequests: Object.freeze(planningRequests),
    skipped: Object.freeze(skipped.map((entry) => Object.freeze({ ...entry }))),
  });
}
