import {
  compareMobilityId,
  validateMobilityModeCandidate,
  type CitizenMobilityState,
  type MobilityModeCandidate,
  type MobilityTrip,
  type MobilityTripMode,
  type MobilityTripPlanningRequest,
} from './contracts.js';
import { MobilityContractError } from './errors.js';
import { formatMobilityTripId } from './mobility-planner.js';
import { createMobilitySnapshot, type MobilitySnapshotV1 } from './mobility-snapshot.js';

function modePriority(mode: MobilityTripMode): number {
  return mode === 'Walk' ? 0 : 1;
}

export function chooseMobilityMode(
  candidates: readonly MobilityModeCandidate[],
): MobilityTripMode | null {
  const valid = candidates.map((candidate) => {
    validateMobilityModeCandidate(candidate);
    return candidate;
  });
  const available = valid
    .filter(
      (candidate): candidate is MobilityModeCandidate & { generalizedCostSeconds: number } =>
        candidate.available && candidate.generalizedCostSeconds !== null,
    )
    .sort((first, second) =>
      first.generalizedCostSeconds !== second.generalizedCostSeconds
        ? first.generalizedCostSeconds - second.generalizedCostSeconds
        : modePriority(first.mode) - modePriority(second.mode),
    );
  return available[0]?.mode ?? null;
}

function replaceCitizenState(
  states: readonly CitizenMobilityState[],
  citizenId: string,
  next: CitizenMobilityState,
): readonly CitizenMobilityState[] {
  let found = false;
  const result = states.map((state) => {
    if (state.citizenId !== citizenId) return state;
    found = true;
    return next;
  });
  if (!found) throw new MobilityContractError('mobility:invalid-state');
  return result.sort((first, second) => compareMobilityId(first.citizenId, second.citizenId));
}

export function commitPlannedMobilityTrip(
  input: Readonly<{
    snapshot: MobilitySnapshotV1;
    request: MobilityTripPlanningRequest;
    candidates: readonly MobilityModeCandidate[];
  }>,
): MobilitySnapshotV1 {
  const snapshot = createMobilitySnapshot(input.snapshot);
  if (input.request.tripId !== formatMobilityTripId(snapshot.nextTripSequence)) {
    throw new MobilityContractError('mobility:invalid-sequence');
  }
  const state = snapshot.citizenStates.find((entry) => entry.citizenId === input.request.citizenId);
  if (state === undefined || state.activeTripId !== null) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  if (snapshot.trips.some((trip) => trip.tripId === input.request.tripId)) {
    throw new MobilityContractError('mobility:duplicate-trip');
  }

  const mode = chooseMobilityMode(input.candidates);
  const trip: MobilityTrip = Object.freeze({
    tripId: input.request.tripId,
    citizenId: input.request.citizenId,
    purpose: input.request.purpose,
    originBuildingId: input.request.originBuildingId,
    destinationBuildingId: input.request.destinationBuildingId,
    mode,
    departureGameMinute: input.request.departureGameMinute,
    status: mode === null ? 'Failed' : 'Active',
    failureReason: mode === null ? 'Unreachable' : null,
  });

  const nextState: CitizenMobilityState =
    mode === null
      ? Object.freeze({
          ...state,
          currentActivity:
            input.request.purpose === 'CommuteToWork' ? ('Home' as const) : ('Work' as const),
          stationaryBuildingId: input.request.originBuildingId,
          activeTripId: null,
        })
      : Object.freeze({
          ...state,
          currentActivity: 'Travel' as const,
          stationaryBuildingId: null,
          activeTripId: input.request.tripId,
        });

  return createMobilitySnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    nextTripSequence: snapshot.nextTripSequence + 1,
    citizenStates: replaceCitizenState(snapshot.citizenStates, input.request.citizenId, nextState),
    trips: [...snapshot.trips, trip],
  });
}
