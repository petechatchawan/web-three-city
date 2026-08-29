import type {
  CellCoord,
  ChunkCoord,
  MapDefinitionRead,
  WorldSpatialRead,
} from "@web-three-city/world";
import type { Group, Raycaster } from "three";
import type { TerrainChangeSet } from "./mutation";
import type { TerrainAuthorityRead, TerrainRevision } from "./terrain-read";
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

export interface TerrainThreeProjection {
  readonly root: Group;
  rebuild(changeSet: TerrainChangeSet): void;
  pick(raycaster: Raycaster): TerrainSemanticPickResult;
  dispose(): void;
}

export interface CreateTerrainThreeProjectionInput {
  readonly mapDefinition: Pick<
    MapDefinitionRead,
    "widthCells" | "heightCells" | "cellSizeMeters"
  >;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}

export type TerrainThreeProjectionConstructionResult =
  | { readonly status: "success"; readonly value: TerrainThreeProjection }
  | {
      readonly status: "rejected";
      readonly code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE";
    };
