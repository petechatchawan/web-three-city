import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { assertCellCoord } from '@web-three-city/world-core';

export interface ChunkCoord {
  readonly x: number;
  readonly z: number;
}

export interface ChunkCellBounds {
  readonly minCellX: number;
  readonly minCellZ: number;
  readonly maxCellX: number;
  readonly maxCellZ: number;
}

function chunkCountX(config: WorldConfig): number {
  return Math.ceil(config.mapWidth / config.chunkSize);
}

function chunkCountZ(config: WorldConfig): number {
  return Math.ceil(config.mapHeight / config.chunkSize);
}

function assertChunkCoord(chunk: ChunkCoord, config: WorldConfig): void {
  if (
    !Number.isInteger(chunk.x) ||
    !Number.isInteger(chunk.z) ||
    chunk.x < 0 ||
    chunk.z < 0 ||
    chunk.x >= chunkCountX(config) ||
    chunk.z >= chunkCountZ(config)
  ) {
    throw new RangeError('terrain:invalid-chunk-coordinate');
  }
}

export function allChunkCoords(config: WorldConfig): readonly ChunkCoord[] {
  const chunks: ChunkCoord[] = [];
  for (let z = 0; z < chunkCountZ(config); z += 1) {
    for (let x = 0; x < chunkCountX(config); x += 1) {
      chunks.push({ x, z });
    }
  }
  return chunks;
}

export function chunkForCell(cell: CellCoord, config: WorldConfig): ChunkCoord {
  assertCellCoord(cell, config);
  return {
    x: Math.floor(cell.x / config.chunkSize),
    z: Math.floor(cell.z / config.chunkSize),
  };
}

export function chunkCellBounds(chunk: ChunkCoord, config: WorldConfig): ChunkCellBounds {
  assertChunkCoord(chunk, config);
  const minCellX = chunk.x * config.chunkSize;
  const minCellZ = chunk.z * config.chunkSize;
  return {
    minCellX,
    minCellZ,
    maxCellX: Math.min(config.mapWidth - 1, minCellX + config.chunkSize - 1),
    maxCellZ: Math.min(config.mapHeight - 1, minCellZ + config.chunkSize - 1),
  };
}
