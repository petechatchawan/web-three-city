import { allChunkCoords, type TerrainSnapshot } from '@web-three-city/terrain-core';
import {
  buildWaterChunkMesh,
  buildWaterWallMesh,
  type WaterSnapshot,
} from '@web-three-city/water-core';
import type { WorldConfig } from '@web-three-city/world-core';
import type { WaterPresentationSource } from './water-presentation.js';

export function createCoreWaterPresentationSource(config: WorldConfig): WaterPresentationSource {
  return {
    buildAll(terrain: TerrainSnapshot, water: WaterSnapshot) {
      return {
        chunks: allChunkCoords(config).map((chunk) =>
          buildWaterChunkMesh(terrain, water, chunk, config),
        ),
        wall: buildWaterWallMesh(terrain, water, config),
      };
    },
  };
}
