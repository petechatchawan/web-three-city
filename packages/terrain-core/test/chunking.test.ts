import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { allChunkCoords, chunkCellBounds, chunkForCell } from '../src/chunking.js';

describe('terrain chunk ownership', () => {
  it('enumerates exactly 64 chunks in row-major order', () => {
    const chunks = allChunkCoords(WORLD_CONFIG);

    expect(chunks).toHaveLength(64);
    expect(chunks[0]).toEqual({ x: 0, z: 0 });
    expect(chunks[63]).toEqual({ x: 7, z: 7 });
  });

  it('maps cells to canonical chunks and bounds', () => {
    expect(chunkForCell({ x: 16, z: 31 }, WORLD_CONFIG)).toEqual({
      x: 1,
      z: 1,
    });
    expect(chunkCellBounds({ x: 1, z: 1 }, WORLD_CONFIG)).toEqual({
      minCellX: 16,
      minCellZ: 16,
      maxCellX: 31,
      maxCellZ: 31,
    });
  });
});
