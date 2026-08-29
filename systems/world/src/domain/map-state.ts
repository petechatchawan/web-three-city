import type { MapDefinitionId, RegionId } from "./coordinates";

export interface MapState {
  readonly mapDefinitionId: MapDefinitionId;
  readonly startingRegionId: RegionId;
  readonly unlockedRegionIds: readonly RegionId[];
}

export type MapStateConstructionFailureReason =
  | "unknown-region"
  | "not-starting-candidate"
  | "not-eligible";

export type MapStateConstructionResult =
  | { readonly status: "success"; readonly value: MapState }
  | {
      readonly status: "rejected";
      readonly reason: MapStateConstructionFailureReason;
    };

export interface CreateInitialMapStateInput {
  readonly mapDefinitionId: MapDefinitionId;
  readonly regionIds: readonly RegionId[];
  readonly startingCandidateRegionIds: readonly RegionId[];
  readonly selectedStartingRegionId: RegionId;
  readonly eligibleStartingRegionIds: readonly RegionId[];
}

export function createInitialMapState(
  input: CreateInitialMapStateInput,
): MapStateConstructionResult {
  const selectedRegionId = input.selectedStartingRegionId;

  if (!input.regionIds.includes(selectedRegionId)) {
    return { status: "rejected", reason: "unknown-region" };
  }
  if (!input.startingCandidateRegionIds.includes(selectedRegionId)) {
    return { status: "rejected", reason: "not-starting-candidate" };
  }
  if (!input.eligibleStartingRegionIds.includes(selectedRegionId)) {
    return { status: "rejected", reason: "not-eligible" };
  }

  const unlockedRegionIds = Object.freeze([selectedRegionId]);
  const value: MapState = Object.freeze({
    mapDefinitionId: input.mapDefinitionId,
    startingRegionId: selectedRegionId,
    unlockedRegionIds,
  });

  return { status: "success", value };
}
