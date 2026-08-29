import type {
  MapStateRead,
  MapStateSnapshot,
  PreparedWorldDefinition,
  WorldConstructionResult,
} from "../contracts/world-read";

export interface RestoredMapState {
  readonly read: MapStateRead;
  captureSnapshot(): MapStateSnapshot;
}

function reject(
  code: "WORLD_SNAPSHOT_INCOMPATIBLE" | "WORLD_SNAPSHOT_INVALID",
  issue: string,
): WorldConstructionResult<RestoredMapState> {
  return {
    status: "rejected",
    code,
    detail: Object.freeze({ issue }),
  };
}

function canonicalRegionOrder(
  regionIds: readonly string[],
  unlockedRegionIds: readonly string[],
): boolean {
  let previousIndex = -1;
  for (const regionId of unlockedRegionIds) {
    const index = regionIds.indexOf(regionId);
    if (index < 0 || index <= previousIndex) return false;
    previousIndex = index;
  }
  return true;
}

export function restoreMapState(input: {
  readonly prepared: PreparedWorldDefinition;
  readonly snapshot: MapStateSnapshot;
}): WorldConstructionResult<RestoredMapState> {
  const definition = input.prepared.mapDefinition;
  const snapshot = input.snapshot;

  if (
    snapshot.mapDefinitionId !== definition.mapDefinitionId ||
    snapshot.mapProfileId !== definition.profileId ||
    snapshot.mapProfileVersion !== definition.profileVersion
  ) {
    return reject("WORLD_SNAPSHOT_INCOMPATIBLE", "map-definition-identity");
  }

  if (!definition.regionIds.includes(snapshot.startingRegionId)) {
    return reject("WORLD_SNAPSHOT_INVALID", "starting-region-unknown");
  }
  if (
    !definition.startingCandidates.some(
      (candidate) => candidate.regionId === snapshot.startingRegionId,
    )
  ) {
    return reject("WORLD_SNAPSHOT_INVALID", "starting-region-not-candidate");
  }

  const unlocked = [...snapshot.unlockedRegionIds];
  if (unlocked.length === 0) {
    return reject("WORLD_SNAPSHOT_INVALID", "unlocked-regions-empty");
  }
  if (new Set(unlocked).size !== unlocked.length) {
    return reject("WORLD_SNAPSHOT_INVALID", "unlocked-regions-duplicate");
  }
  if (!canonicalRegionOrder(definition.regionIds, unlocked)) {
    return reject("WORLD_SNAPSHOT_INVALID", "unlocked-regions-noncanonical");
  }
  if (!unlocked.includes(snapshot.startingRegionId)) {
    return reject("WORLD_SNAPSHOT_INVALID", "starting-region-not-unlocked");
  }

  const frozenUnlocked = Object.freeze([...unlocked]);
  const read: MapStateRead = Object.freeze({
    mapDefinitionId: definition.mapDefinitionId,
    startingRegionId: snapshot.startingRegionId,
    unlockedRegionIds: frozenUnlocked,
  });
  const canonicalSnapshot: MapStateSnapshot = Object.freeze({
    mapDefinitionId: definition.mapDefinitionId,
    mapProfileId: definition.profileId,
    mapProfileVersion: definition.profileVersion,
    startingRegionId: snapshot.startingRegionId,
    unlockedRegionIds: frozenUnlocked,
  });

  return {
    status: "success",
    value: Object.freeze({
      read,
      captureSnapshot(): MapStateSnapshot {
        return canonicalSnapshot;
      },
    }),
  };
}
