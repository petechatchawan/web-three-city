import { createTerrainAuthorityInternal } from "./composition/create-terrain";
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

export function createTerrainAuthoritySystem(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainAuthoritySystem> {
  return constructTerrainAuthority(input);
}

export type {
  CreateTerrainAuthorityInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainFieldSource,
} from "./contracts/terrain-composition";
