import type {
  TerrainDebugConfig,
  TerrainDebugVisibility,
} from "../../../contracts/terrain-debug";
import {
  TERRAIN_GENERATION_MAX_ELEVATION,
  TERRAIN_GENERATION_MIN_ELEVATION,
} from "../../../domain/generation/profile";

export const TERRAIN_DEBUG_HIDDEN: TerrainDebugVisibility = Object.freeze({
  cellGrid: false,
  renderSectors: false,
  vertices: false,
  triangles: false,
  normals: false,
  elevation: false,
});

export const TERRAIN_DEBUG_DEFAULT_CONFIG: TerrainDebugConfig = Object.freeze({
  visibility: TERRAIN_DEBUG_HIDDEN,
  surfaceOffsetMeters: 0.05,
  normalSampleStrideCells: 8,
  normalLengthMeters: 6,
  pointSizePixels: 3,
  lineOpacity: 0.68,
  elevationOpacity: 0.72,
  elevationMinLogical: TERRAIN_GENERATION_MIN_ELEVATION,
  elevationMaxLogical: TERRAIN_GENERATION_MAX_ELEVATION,
});
