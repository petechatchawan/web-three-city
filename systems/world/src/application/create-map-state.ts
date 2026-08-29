import type {
  CreateInitialWorldInput,
  MapStateRead,
  MapStateSnapshot,
  WorldConstructionResult,
  WorldErrorCode,
} from "../contracts/world-read";
import {
  createInitialMapState,
  type MapStateConstructionFailureReason,
} from "../domain/map-state";

export interface CreatedMapState {
  readonly read: MapStateRead;
  captureSnapshot(): MapStateSnapshot;
}

function rejectionCode(
  reason: MapStateConstructionFailureReason,
): WorldErrorCode {
  switch (reason) {
    case "unknown-region":
      return "WORLD_REGION_UNKNOWN";
    case "not-starting-candidate":
      return "WORLD_STARTING_CANDIDATE_INVALID";
    case "not-eligible":
      return "WORLD_STARTING_REGION_NOT_ELIGIBLE";
  }
}

export function createMapState(
  input: CreateInitialWorldInput,
): WorldConstructionResult<CreatedMapState> {
  const definition = input.prepared.mapDefinition;
  const result = createInitialMapState({
    mapDefinitionId: definition.mapDefinitionId,
    regionIds: definition.regionIds,
    startingCandidateRegionIds: definition.startingCandidates.map(
      (candidate) => candidate.regionId,
    ),
    selectedStartingRegionId: input.selectedStartingRegionId,
    eligibleStartingRegionIds: input.eligibleStartingRegionIds,
  });

  if (result.status === "rejected") {
    return { status: "rejected", code: rejectionCode(result.reason) };
  }

  const read: MapStateRead = result.value;
  const snapshot: MapStateSnapshot = Object.freeze({
    mapDefinitionId: definition.mapDefinitionId,
    mapProfileId: definition.profileId,
    mapProfileVersion: definition.profileVersion,
    startingRegionId: result.value.startingRegionId,
    unlockedRegionIds: result.value.unlockedRegionIds,
  });
  const value: CreatedMapState = Object.freeze({
    read,
    captureSnapshot(): MapStateSnapshot {
      return snapshot;
    },
  });

  return { status: "success", value };
}
