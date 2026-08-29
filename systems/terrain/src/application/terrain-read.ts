import type { WorldSpatialRead } from "@web-three-city/world";
import type {
  TerrainAuthorityRead,
  TerrainRevision,
} from "../contracts/terrain-read";
import type { TerrainState } from "../domain/terrain-state";
import {
  readTerrainElevation,
  terrainCompleteness,
} from "../domain/terrain-state";
import { toChunkKey, toVertexKey } from "./world-index";

export interface CreateTerrainAuthorityReadInput {
  readonly state: TerrainState;
  readonly world: WorldSpatialRead;
  readonly vertexWidth: number;
}

export function createTerrainAuthorityRead(
  input: CreateTerrainAuthorityReadInput,
): TerrainAuthorityRead {
  return {
    revision() {
      return input.state.revision as TerrainRevision;
    },
    completeness() {
      return terrainCompleteness(input.state);
    },
    elevationAt(vertex) {
      const owner = input.world.ownerChunk(vertex);
      if (owner.status !== "success") {
        return {
          status: "out-of-bounds",
          code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
        };
      }

      const elevation = readTerrainElevation(
        input.state,
        toChunkKey(owner.value),
        toVertexKey(vertex, input.vertexWidth),
      );
      if (elevation.status === "unavailable") {
        return {
          status: "unavailable",
          code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
          chunk: owner.value,
        };
      }

      return elevation;
    },
  };
}
