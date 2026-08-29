import { prepareProductionTerrainInternal } from "./application/prepare-production-terrain";
import {
  createTerrainAuthorityInternal,
  createTerrainSystemInternal,
} from "./composition/create-terrain";
import type {
  PrepareProductionTerrainInput,
  PreparedProductionTerrain,
  TerrainGenerationResult,
} from "./contracts/generation";
import type {
  CreateTerrainAuthorityInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainSystem,
} from "./contracts/terrain-composition";

function constructTerrainAuthority(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainAuthoritySystem> {
  return createTerrainAuthorityInternal(input);
}

function constructTerrainSystem(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainSystem> {
  return createTerrainSystemInternal(input);
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

export function createTerrainSystem(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainSystem> {
  return constructTerrainSystem(input);
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
  TerrainSystem,
} from "./contracts/terrain-composition";
