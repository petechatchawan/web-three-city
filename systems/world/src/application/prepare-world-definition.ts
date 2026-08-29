import type {
  MapDefinitionRead,
  PreparedWorldDefinition,
  WorldConstructionResult,
  WorldErrorCode,
} from "../contracts/world-read";
import type { StartingCandidate } from "../domain/coordinates";
import { isValidCell } from "../domain/grid-topology";
import {
  createProductionMapDefinitionSource,
  type MapDefinitionSource,
} from "../domain/map-definition";
import {
  prepareRegionIndex,
  type PreparedRegionIndex,
  type RegionPreparationFailureReason,
} from "../domain/region-geometry";
import { createWorldSpatialRead } from "./world-spatial-read";

function rejection<T>(
  code: WorldErrorCode,
  detail: Record<string, unknown>,
): WorldConstructionResult<T> {
  return { status: "rejected", code, detail: Object.freeze(detail) };
}

function regionFailureCode(reason: RegionPreparationFailureReason): WorldErrorCode {
  switch (reason) {
    case "geometry":
      return "WORLD_REGION_GEOMETRY_INVALID";
    case "overlap":
      return "WORLD_REGION_PARTITION_OVERLAP";
    case "incomplete":
      return "WORLD_REGION_PARTITION_INCOMPLETE";
  }
}

function hasExactProductionIdentity(source: MapDefinitionSource): boolean {
  return (
    source.mapDefinitionId === "web-three-city-production" &&
    source.profileId === "production-v1" &&
    source.profileVersion === 1 &&
    source.widthCells === 512 &&
    source.heightCells === 512 &&
    source.cellSizeMeters === 8 &&
    source.logicalChunkSizeCells === 32 &&
    source.terrainGenerationProfileId === "balanced-temperate-generation" &&
    source.terrainGenerationProfileVersion === 2
  );
}

function expectedRegionIds(): readonly string[] {
  return Object.freeze(
    Array.from({ length: 20 }, (_, index) =>
      `R${index.toString().padStart(2, "0")}`,
    ),
  );
}

function validateRegionIdentity(source: MapDefinitionSource): WorldConstructionResult<true> {
  const actual = source.regions.map((region) => region.id);
  const expected = expectedRegionIds();
  const unique = new Set(actual);
  if (
    actual.length !== 20 ||
    unique.size !== actual.length ||
    actual.some((regionId, index) => regionId !== expected[index])
  ) {
    return rejection("WORLD_MAP_DEFINITION_INVALID", {
      issue: "region-identity",
      expected,
      actual: Object.freeze(actual),
    });
  }
  return { status: "success", value: true };
}

function validateSeedCatalog(source: MapDefinitionSource): WorldConstructionResult<true> {
  const seeds = source.acceptedTerrainSeeds;
  if (
    seeds.length !== 1 ||
    seeds[0] !== "0x5EED5EED5EED5EED" ||
    !/^0x[0-9A-F]{16}$/.test(seeds[0] ?? "")
  ) {
    return rejection("WORLD_MAP_DEFINITION_INVALID", {
      issue: "accepted-terrain-seeds",
      seeds: Object.freeze([...seeds]),
    });
  }
  return { status: "success", value: true };
}

function validateCandidates(
  source: MapDefinitionSource,
  regions: PreparedRegionIndex,
): WorldConstructionResult<true> {
  const expectedIds = ["R06", "R08", "R11", "R13"];
  if (
    source.startingCandidates.length !== 4 ||
    source.startingCandidates.some(
      (candidate, index) => candidate.regionId !== expectedIds[index],
    )
  ) {
    return rejection("WORLD_STARTING_CANDIDATE_INVALID", {
      issue: "candidate-order",
    });
  }

  for (const candidate of source.startingCandidates) {
    if (!isValidCell(candidate.anchor)) {
      return rejection("WORLD_STARTING_CANDIDATE_INVALID", {
        issue: "anchor-out-of-bounds",
        regionId: candidate.regionId,
      });
    }

    for (let dz = -4; dz <= 4; dz += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const cell = {
          x: candidate.anchor.x + dx,
          z: candidate.anchor.z + dz,
        };
        if (!isValidCell(cell) || regions.regionAt(cell) !== candidate.regionId) {
          return rejection("WORLD_STARTING_CANDIDATE_INVALID", {
            issue: "candidate-patch-crosses-region",
            regionId: candidate.regionId,
            cell: Object.freeze(cell),
          });
        }
      }
    }
  }

  return { status: "success", value: true };
}

function freezeCandidates(
  candidates: readonly StartingCandidate[],
): readonly StartingCandidate[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze({
        regionId: candidate.regionId,
        anchor: Object.freeze({ ...candidate.anchor }),
      }),
    ),
  );
}

function prepareDefinition(
  source: MapDefinitionSource,
): WorldConstructionResult<PreparedWorldDefinition> {
  if (!hasExactProductionIdentity(source)) {
    return rejection("WORLD_MAP_DEFINITION_INVALID", {
      issue: "production-identity",
    });
  }

  const regionIdentity = validateRegionIdentity(source);
  if (regionIdentity.status === "rejected") {
    return regionIdentity;
  }
  const seedCatalog = validateSeedCatalog(source);
  if (seedCatalog.status === "rejected") {
    return seedCatalog;
  }

  const preparedRegions = prepareRegionIndex(
    source.regions,
    source.widthCells,
    source.heightCells,
  );
  if (preparedRegions.status === "rejected") {
    return rejection(regionFailureCode(preparedRegions.reason), {
      ...preparedRegions.detail,
    });
  }

  const candidateValidation = validateCandidates(source, preparedRegions.value);
  if (candidateValidation.status === "rejected") {
    return candidateValidation;
  }

  const mapDefinition: MapDefinitionRead = Object.freeze({
    mapDefinitionId: "web-three-city-production",
    profileId: "production-v1",
    profileVersion: 1,
    widthCells: 512,
    heightCells: 512,
    cellSizeMeters: 8,
    logicalChunkSizeCells: 32,
    terrainGenerationProfileId: "balanced-temperate-generation",
    terrainGenerationProfileVersion: 2,
    regionIds: preparedRegions.value.regionIds,
    startingCandidates: freezeCandidates(source.startingCandidates),
    acceptedTerrainSeeds: Object.freeze([...source.acceptedTerrainSeeds]),
  });
  const spatial = createWorldSpatialRead(preparedRegions.value);

  return {
    status: "success",
    value: Object.freeze({ mapDefinition, spatial }),
  };
}

export function prepareProductionWorldDefinition(): WorldConstructionResult<PreparedWorldDefinition> {
  return prepareDefinition(createProductionMapDefinitionSource());
}
