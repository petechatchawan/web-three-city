import type {
  MapDefinitionRead,
  WorldSpatialRead,
} from "@web-three-city/world";
import type { Group } from "three";
import type { TerrainChangeSet } from "./mutation";
import type { TerrainAuthorityRead } from "./terrain-read";

export type TerrainDebugLayer =
  | "cellGrid"
  | "renderSectors"
  | "vertices"
  | "triangles"
  | "normals"
  | "elevation";

export interface TerrainDebugVisibility {
  readonly cellGrid: boolean;
  readonly renderSectors: boolean;
  readonly vertices: boolean;
  readonly triangles: boolean;
  readonly normals: boolean;
  readonly elevation: boolean;
}

export interface TerrainDebugConfig {
  readonly visibility: TerrainDebugVisibility;
  readonly surfaceOffsetMeters: number;
  readonly normalSampleStrideCells: number;
  readonly normalLengthMeters: number;
  readonly pointSizePixels: number;
  readonly lineOpacity: number;
  readonly elevationOpacity: number;
  readonly elevationMinLogical: number;
  readonly elevationMaxLogical: number;
}

export interface TerrainThreeDebugOverlay {
  readonly root: Group;
  visibility(): TerrainDebugVisibility;
  setVisibility(next: Partial<TerrainDebugVisibility>): void;
  rebuild(changeSet: TerrainChangeSet): void;
  dispose(): void;
}

export interface CreateTerrainThreeDebugOverlayInput {
  readonly mapDefinition: Pick<
    MapDefinitionRead,
    "widthCells" | "heightCells" | "cellSizeMeters"
  >;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
  readonly config?: TerrainDebugConfig;
}

export type TerrainThreeDebugOverlayConstructionResult =
  | { readonly status: "success"; readonly value: TerrainThreeDebugOverlay }
  | {
      readonly status: "rejected";
      readonly code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE";
    };
