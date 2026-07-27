import type { WorldConfig } from '@web-three-city/world-core';
import type { ChunkCoord } from './chunking.js';

export interface TerrainDirtyRegion {
  readonly minVertexX: number;
  readonly minVertexZ: number;
  readonly maxVertexX: number;
  readonly maxVertexZ: number;
}

function assertDirtyRegion(region: TerrainDirtyRegion, config: WorldConfig): void {
  if (
    !Number.isInteger(region.minVertexX) ||
    !Number.isInteger(region.minVertexZ) ||
    !Number.isInteger(region.maxVertexX) ||
    !Number.isInteger(region.maxVertexZ) ||
    region.minVertexX < 0 ||
    region.minVertexZ < 0 ||
    region.maxVertexX > config.mapWidth ||
    region.maxVertexZ > config.mapHeight ||
    region.minVertexX > region.maxVertexX ||
    region.minVertexZ > region.maxVertexZ
  ) {
    throw new RangeError('terrain:invalid-dirty-region');
  }
}

export function resolveDirtyChunks(
  region: TerrainDirtyRegion,
  config: WorldConfig,
): readonly ChunkCoord[] {
  assertDirtyRegion(region, config);

  const minCellX = Math.max(0, region.minVertexX - 2);
  const minCellZ = Math.max(0, region.minVertexZ - 2);
  const maxCellX = Math.min(config.mapWidth - 1, region.maxVertexX + 1);
  const maxCellZ = Math.min(config.mapHeight - 1, region.maxVertexZ + 1);
  const chunks = new Map<number, ChunkCoord>();
  const chunksPerRow = Math.ceil(config.mapWidth / config.chunkSize);

  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const chunk = {
        x: Math.floor(cellX / config.chunkSize),
        z: Math.floor(cellZ / config.chunkSize),
      };
      chunks.set(chunk.z * chunksPerRow + chunk.x, chunk);
    }
  }

  return [...chunks.values()].sort((first, second) => first.z - second.z || first.x - second.x);
}
