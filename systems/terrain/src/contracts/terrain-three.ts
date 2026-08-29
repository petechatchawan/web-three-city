import type { CellCoord, ChunkCoord } from "@web-three-city/world";
import type { TerrainRevision } from "./terrain-read";
import type { TerrainTriangle } from "../domain/surface";

export interface TerrainSemanticPick {
  readonly cell: CellCoord;
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly revision: TerrainRevision;
}

export type TerrainSemanticPickResult =
  | { readonly status: "hit"; readonly value: TerrainSemanticPick }
  | {
      readonly status: "miss";
      readonly reason:
        | "NO_TERRAIN_INTERSECTION"
        | "WORLD_POSITION_OUT_OF_BOUNDS";
    }
  | {
      readonly status: "unavailable";
      readonly code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE";
      readonly chunk: ChunkCoord;
    };
