import type { ChunkCoord } from "@web-three-city/world";
import type { LogicalElevation } from "../domain/elevation";

export type TerrainRevision = number & {
  readonly __terrainRevisionFlavor?: "TerrainRevision";
};

export type TerrainCompleteness = "partial" | "full";

export type TerrainQueryResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "out-of-bounds";
      readonly code: "TERRAIN_QUERY_OUT_OF_BOUNDS";
    }
  | {
      readonly status: "unavailable";
      readonly code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE";
      readonly chunk: ChunkCoord;
    };

export interface TerrainAuthorityRead {
  readonly revision: TerrainRevision;
  readonly completeness: TerrainCompleteness;
  elevationAtVertex(
    vertex: import("@web-three-city/world").VertexCoord,
  ): TerrainQueryResult<LogicalElevation>;
}
