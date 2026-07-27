import { err, ok } from '@web-three-city/world-core';
import type { Result, WorldConfig } from '@web-three-city/world-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import type { TerrainMap } from '@web-three-city/terrain-core';
import { COASTAL_V1 } from './coastal-config.js';
import { createCoastProfile, createInitialCoastalLevels } from './coastal-fields.js';
import { projectCardinalConstraints } from './constraint-projection.js';
import { mix32, Xoshiro128StarStar } from './prng.js';
import { calculateTerrainStatistics } from './statistics.js';

export type TerrainGenerationErrorCode =
  | 'invalid-config'
  | 'constraint-unsatisfied'
  | 'insufficient-landmass'
  | 'insufficient-buildable-area'
  | 'invalid-height-range';

export interface TerrainGenerationError {
  readonly code: TerrainGenerationErrorCode;
  readonly attempt?: number;
}

export interface GenerateCoastalTerrainInput {
  readonly seed: number;
  readonly config: WorldConfig;
}

function validConfig(config: WorldConfig): boolean {
  return (
    config.mapWidth === 128 &&
    config.mapHeight === 128 &&
    config.chunkSize === 16 &&
    config.minHeightLevel === 0 &&
    config.maxHeightLevel === 4 &&
    config.seaLevel === 1
  );
}

function meetsTargets(map: TerrainMap, config: WorldConfig): TerrainGenerationErrorCode | null {
  const statistics = calculateTerrainStatistics(map, config);
  if (statistics.fullyWaterRatio < 0.18 || statistics.fullyWaterRatio > 0.22) {
    return 'invalid-height-range';
  }
  if (statistics.largestLandmassRatio < 0.72) return 'insufficient-landmass';
  if (
    statistics.flatBuildableRatio < 0.3 ||
    statistics.largestBuildableSquare < 24 ||
    statistics.level4PlateauRatio > 0.12
  ) {
    return 'insufficient-buildable-area';
  }
  if (
    statistics.isolatedSpikeCount > 0 ||
    statistics.isolatedPitCount > 0 ||
    statistics.maxCardinalVertexDelta > 1
  ) {
    return 'constraint-unsatisfied';
  }
  return null;
}

export function generateCoastalTerrain(
  input: GenerateCoastalTerrainInput,
): Result<TerrainMap, TerrainGenerationError> {
  if (!Number.isInteger(input.seed) || !validConfig(input.config)) {
    return err({ code: 'invalid-config' });
  }

  let lastError: TerrainGenerationErrorCode = 'constraint-unsatisfied';
  const latticeWidth = input.config.mapWidth + 1;
  const latticeHeight = input.config.mapHeight + 1;
  const maxPasses = 2 * (latticeWidth + latticeHeight);

  for (let attempt = 0; attempt < COASTAL_V1.maxAttempts; attempt += 1) {
    const attemptSeed = mix32(input.seed ^ Math.imul(attempt + 1, 0x9e3779b9));
    const rng = Xoshiro128StarStar.fromSeed(attemptSeed);
    const profile = createCoastProfile(input.config.mapWidth, rng);
    const initial = createInitialCoastalLevels(
      input.config.mapWidth,
      input.config.mapHeight,
      profile,
    );
    const projected = projectCardinalConstraints(
      initial,
      latticeWidth,
      latticeHeight,
      maxPasses,
    );
    if (!projected.ok) {
      lastError = 'constraint-unsatisfied';
      continue;
    }

    try {
      const map = createTerrainMap({
        config: input.config,
        heightLevels: projected.value,
        seed: input.seed,
        generatorVersion: COASTAL_V1.generatorVersion,
        generationAttempt: attempt,
        revision: 0,
      });
      const targetError = meetsTargets(map, input.config);
      if (targetError === null) return ok(map);
      lastError = targetError;
    } catch {
      lastError = 'invalid-height-range';
    }
  }

  return err({ code: lastError, attempt: COASTAL_V1.maxAttempts - 1 });
}
