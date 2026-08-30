import type { RegionId, StartingCandidate } from "./coordinates";
import type { RegionDefinition } from "./region-geometry";

export interface MapDefinitionSource {
  readonly mapDefinitionId: string;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
  readonly logicalChunkSizeCells: number;
  readonly terrainGenerationProfileId: string;
  readonly terrainGenerationProfileVersion: number;
  readonly regions: readonly RegionDefinition[];
  readonly startingCandidates: readonly StartingCandidate[];
}

export const PRODUCTION_X_BOUNDARIES = Object.freeze([
  0, 102, 205, 307, 410, 512,
]);
export const PRODUCTION_Z_BOUNDARIES = Object.freeze([0, 128, 256, 384, 512]);

function productionRegionId(index: number): RegionId {
  return `R${index.toString().padStart(2, "0")}`;
}

function createProductionRegions(): readonly RegionDefinition[] {
  const regions: RegionDefinition[] = [];

  for (let rz = 0; rz < 4; rz += 1) {
    const zStart = PRODUCTION_Z_BOUNDARIES[rz];
    const zEnd = PRODUCTION_Z_BOUNDARIES[rz + 1];
    if (zStart === undefined || zEnd === undefined) {
      continue;
    }

    for (let rx = 0; rx < 5; rx += 1) {
      const xStart = PRODUCTION_X_BOUNDARIES[rx];
      const xEnd = PRODUCTION_X_BOUNDARIES[rx + 1];
      if (xStart === undefined || xEnd === undefined) {
        continue;
      }

      const runs = [];
      for (let z = zStart; z < zEnd; z += 1) {
        runs.push(
          Object.freeze({ z, xStartInclusive: xStart, xEndExclusive: xEnd }),
        );
      }
      regions.push(
        Object.freeze({
          id: productionRegionId(rz * 5 + rx),
          runs: Object.freeze(runs),
        }),
      );
    }
  }

  return Object.freeze(regions);
}

const PRODUCTION_STARTING_CANDIDATES: readonly StartingCandidate[] =
  Object.freeze([
    Object.freeze({
      regionId: "R06",
      anchor: Object.freeze({ x: 153, z: 191 }),
    }),
    Object.freeze({
      regionId: "R08",
      anchor: Object.freeze({ x: 358, z: 191 }),
    }),
    Object.freeze({
      regionId: "R11",
      anchor: Object.freeze({ x: 153, z: 319 }),
    }),
    Object.freeze({
      regionId: "R13",
      anchor: Object.freeze({ x: 358, z: 319 }),
    }),
  ]);

export function createProductionMapDefinitionSource(): MapDefinitionSource {
  return Object.freeze({
    mapDefinitionId: "web-three-city-production",
    profileId: "production-v1",
    profileVersion: 1,
    widthCells: 512,
    heightCells: 512,
    cellSizeMeters: 8,
    logicalChunkSizeCells: 32,
    terrainGenerationProfileId: "balanced-temperate-generation",
    terrainGenerationProfileVersion: 2,
    regions: createProductionRegions(),
    startingCandidates: PRODUCTION_STARTING_CANDIDATES,
  });
}
