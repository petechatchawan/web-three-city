import type {
  CreateTerrainThreeDebugOverlayInput,
  TerrainThreeDebugOverlayConstructionResult,
} from "./contracts/terrain-debug";
import { prepareProductionTerrainInternal } from "./application/prepare-production-terrain";
import {
  createTerrainAuthorityInternal,
  createTerrainSystemInternal,
  restoreTerrainSystemInternal,
  createTerrainThreeProjectionCompositionInternal,
  createTerrainThreeDebugOverlayCompositionInternal,
} from "./composition/create-terrain";
import type {
  PrepareProductionTerrainInput,
  PreparedProductionTerrain,
  TerrainGenerationResult,
} from "./contracts/generation";
import type {
  CreateTerrainAuthorityInput,
  RestoreTerrainInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainSystem,
} from "./contracts/terrain-composition";
import type {
  CreateTerrainThreeProjectionInput,
  TerrainThreeProjectionConstructionResult,
} from "./contracts/terrain-three";

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

function constructTerrainThreeProjection(
  input: CreateTerrainThreeProjectionInput,
): TerrainThreeProjectionConstructionResult {
  return createTerrainThreeProjectionCompositionInternal(input);
}

function prepareTerrain(
  input: PrepareProductionTerrainInput,
): TerrainGenerationResult<PreparedProductionTerrain> {
  return prepareProductionTerrainInternal(input);
}

function constructTerrainThreeDebugOverlay(
  input: CreateTerrainThreeDebugOverlayInput,
): TerrainThreeDebugOverlayConstructionResult {
  return createTerrainThreeDebugOverlayCompositionInternal(input);
}

export function createTerrainThreeDebugOverlay(
  input: CreateTerrainThreeDebugOverlayInput,
): TerrainThreeDebugOverlayConstructionResult {
  return constructTerrainThreeDebugOverlay(input);
}

export function createTerrainThreeProjection(
  input: CreateTerrainThreeProjectionInput,
): TerrainThreeProjectionConstructionResult {
  return constructTerrainThreeProjection(input);
}

export function prepareProductionTerrain(
  input: PrepareProductionTerrainInput,
): TerrainGenerationResult<PreparedProductionTerrain> {
  return prepareTerrain(input);
}

function constructRestoredTerrain(
  input: RestoreTerrainInput,
): TerrainConstructionResult<TerrainSystem> {
  return restoreTerrainSystemInternal(input);
}

export function restoreTerrainSystem(
  input: RestoreTerrainInput,
): TerrainConstructionResult<TerrainSystem> {
  return constructRestoredTerrain(input);
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
  RestoreTerrainInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainFieldSource,
  TerrainSystem,
} from "./contracts/terrain-composition";

export type {
  CreateTerrainThreeProjectionInput,
  TerrainSemanticPick,
  TerrainSemanticPickResult,
  TerrainThreeProjection,
  TerrainThreeProjectionConstructionResult,
} from "./contracts/terrain-three";

export type {
  CreateTerrainThreeDebugOverlayInput,
  TerrainDebugConfig,
  TerrainDebugLayer,
  TerrainDebugVisibility,
  TerrainThreeDebugOverlay,
  TerrainThreeDebugOverlayConstructionResult,
} from "./contracts/terrain-debug";
