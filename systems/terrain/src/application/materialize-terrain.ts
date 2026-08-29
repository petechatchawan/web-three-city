import type { VertexCoord } from "@web-three-city/world";
import type {
  CreateTerrainAuthorityInput,
  TerrainConstructionResult,
} from "../contracts/terrain-composition";
import { parseLogicalElevation } from "../domain/elevation";
import {
  createTerrainState,
  type CanonicalVertexRecord,
  type TerrainState,
} from "../domain/terrain-state";
import {
  TERRAIN_LOGICAL_CHUNK_COUNT,
  TERRAIN_VERTEX_AXIS_COUNT,
  toChunkKey,
  toVertexKey,
} from "./world-index";

export function materializeTerrain(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainState> {
  if (
    input.source.vertexWidth !== TERRAIN_VERTEX_AXIS_COUNT ||
    input.source.vertexHeight !== TERRAIN_VERTEX_AXIS_COUNT
  ) {
    return {
      status: "rejected",
      reason: "invalid-source-dimensions",
      detail: {
        vertexWidth: input.source.vertexWidth,
        vertexHeight: input.source.vertexHeight,
      },
    };
  }

  const staged: CanonicalVertexRecord[] = [];

  for (let z = 0; z < TERRAIN_VERTEX_AXIS_COUNT; z += 1) {
    for (let x = 0; x < TERRAIN_VERTEX_AXIS_COUNT; x += 1) {
      const parsed = parseLogicalElevation(input.source.elevationAt(x, z));
      if (parsed.status === "rejected") {
        return {
          status: "rejected",
          reason: "invalid-elevation",
          detail: { x, z, code: parsed.code },
        };
      }

      const vertex: VertexCoord = { x, z };
      const owner = input.world.ownerChunk(vertex);
      if (owner.status !== "success") {
        return {
          status: "rejected",
          reason: "world-topology-rejected",
          detail: { x, z, code: owner.code },
        };
      }

      staged.push({
        chunkKey: toChunkKey(owner.value),
        vertexKey: toVertexKey(vertex),
        elevation: parsed.value,
      });
    }
  }

  return {
    status: "success",
    value: createTerrainState({
      provenance: {
        mapDefinitionId: input.mapDefinitionId,
        generationProfileId: input.generationProfileId,
        generationProfileVersion: input.generationProfileVersion,
        selectedSeed64: input.selectedSeed64,
      },
      records: staged,
      loadedChunkKeys: Array.from(
        { length: TERRAIN_LOGICAL_CHUNK_COUNT },
        (_, chunkKey) => chunkKey,
      ),
      expectedChunkCount: TERRAIN_LOGICAL_CHUNK_COUNT,
    }),
  };
}
