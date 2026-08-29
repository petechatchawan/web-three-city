import { prepareProductionTerrainInternal } from "./application/prepare-production-terrain";
import { createTerrainAuthorityInternal } from "./composition/create-terrain";
import type {
  PrepareProductionTerrainInput,
  PreparedProductionTerrain,
  TerrainGenerationResult,
} from "./contracts/generation";
import type {
  CreateTerrainAuthorityInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
} from "./contracts/terrain-composition";

function constructTerrainAuthority(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainAuthoritySystem> {
  return createTerrainAuthorityInternal(input);
}

function prepareTerrain(
  input: PrepareProductionTerrainInput,
): TerrainGenerationResult<PreparedProductionTerrain> {
  return prepareProductionTerrainInternal(input);
}

export function prepareProductionTerrain(
  input: PrepareProductionTerrainInput,
): TerrainGenerationResult<PreparedProductionTerrain> {
  return prepareTerrain(input);
}

export function createTerrainAuthoritySystem(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainAuthoritySystem> {
  return constructTerrainAuthority(input);
}

export type {
  PrepareProductionTerrainInput,
  PreparedProductionTerrain,
  StartingCandidateEvaluation,
  TerrainGenerationRejectionCode,
  TerrainGenerationResult,
  TerrainStartingReason,
} from "./contracts/generation";

export type {
  CreateTerrainAuthorityInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainFieldSource,
} from "./contracts/terrain-composition";
