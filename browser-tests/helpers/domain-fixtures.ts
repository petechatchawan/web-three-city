import {
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  planRoadMutation,
  type RoadPlacementEnvironment,
} from '../../packages/road-core/src/index.js';
import {
  CELL_TRIANGLES,
  encodeTerrainSaveV1,
  planTerraformStroke,
  rasterizeTerraformCellLine,
  selectTerrainDiagonal,
  terrainCellSurfaceProfile,
  type TerrainCorner,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformOperation,
} from '../../packages/terrain-core/src/index.js';
import { generateCoastalTerrain } from '../../packages/terrain-generator/src/index.js';
import { deriveWaterSnapshot, triangleIndexFor } from '../../packages/water-core/src/index.js';
import { WORLD_CONFIG, type CellCoord } from '../../packages/world-core/src/index.js';
import {
  createEmptyZoneSnapshot,
  planZoneMutation,
  type ZoneDefinitionId,
} from '../../packages/zone-core/src/index.js';
import { createRoadPlacementEnvironment } from '../../apps/game/src/road-placement-environment.js';
import { createZonePlacementEnvironment } from '../../apps/game/src/zone-placement-environment.js';

export const GAME_SEED = 1_464_156_977;

export const GAME_TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: GAME_SEED, config: WORLD_CONFIG });
  if (!result.ok) throw new Error(`browser-fixture:terrain:${result.error.code}`);
  return result.value;
})();

export const GAME_WATER = (() => {
  const result = deriveWaterSnapshot(GAME_TERRAIN, WORLD_CONFIG);
  if (!result.ok) throw new Error(`browser-fixture:water:${result.error.code}`);
  return result.value;
})();

export const ROAD_PLACEMENT_ENVIRONMENT = createRoadPlacementEnvironment(
  GAME_TERRAIN,
  GAME_WATER,
  WORLD_CONFIG,
);

export const EMPTY_WORLD_OCCUPANCY = Object.freeze({
  revision: 0,
  isBlocked: () => false,
});

export {
  CELL_TRIANGLES,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  createEmptyZoneSnapshot,
  createRoadPlacementEnvironment,
  createRoadSnapshot,
  createZonePlacementEnvironment,
  deriveWaterSnapshot,
  encodeTerrainSaveV1,
  generateCoastalTerrain,
  planRoadMutation,
  planTerraformStroke,
  planZoneMutation,
  rasterizeTerraformCellLine,
  selectTerrainDiagonal,
  terrainCellSurfaceProfile,
  triangleIndexFor,
};

export type {
  CellCoord,
  RoadPlacementEnvironment,
  TerrainCorner,
  TerrainSnapshot,
  TerraformBrushSize,
  TerraformOperation,
  ZoneDefinitionId,
};
