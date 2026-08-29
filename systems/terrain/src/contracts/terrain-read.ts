import type { CellCoord, ChunkCoord, VertexCoord } from "@web-three-city/world";
import type { LogicalElevation } from "../domain/elevation";
import type { TerrainTriangle } from "../domain/surface";

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

export interface CellSurfaceRead {
  readonly cell: CellCoord;
  readonly sw: LogicalElevation;
  readonly se: LogicalElevation;
  readonly nw: LogicalElevation;
  readonly ne: LogicalElevation;
  readonly revision: TerrainRevision;
}

export interface SurfaceSampleRead {
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly runUnits: 32;
  readonly revision: TerrainRevision;
}

export interface TerrainAuthorityRead {
  revision(): TerrainRevision;
  completeness(): TerrainCompleteness;
  elevationAt(vertex: VertexCoord): TerrainQueryResult<LogicalElevation>;
  cellSurface(cell: CellCoord): TerrainQueryResult<CellSurfaceRead>;
  sampleSurface(
    cell: CellCoord,
    uQ16: number,
    vQ16: number,
  ): TerrainQueryResult<SurfaceSampleRead>;
}
