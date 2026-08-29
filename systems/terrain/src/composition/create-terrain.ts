import type {
  CreateTerrainAuthorityInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
} from "../contracts/terrain-composition";
import { createTerrainAuthorityRead } from "../application/terrain-read";
import { materializeTerrain } from "../application/materialize-terrain";
import { TERRAIN_VERTEX_AXIS_COUNT } from "../application/world-index";

export function createTerrainAuthorityInternal(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainAuthoritySystem> {
  const materialized = materializeTerrain(input);
  if (materialized.status === "rejected") return materialized;

  return {
    status: "success",
    value: {
      read: createTerrainAuthorityRead({
        state: materialized.value,
        world: input.world,
        vertexWidth: TERRAIN_VERTEX_AXIS_COUNT,
      }),
    },
  };
}
