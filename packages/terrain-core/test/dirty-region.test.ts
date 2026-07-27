import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { resolveDirtyChunks } from '../src/dirty-region.js';

describe('dirty-region invalidation', () => {
  it('includes both chunks for a seam vertex change', () => {
    expect(
      resolveDirtyChunks(
        { minVertexX: 16, minVertexZ: 8, maxVertexX: 16, maxVertexZ: 8 },
        WORLD_CONFIG,
      ),
    ).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]);
  });

  it('keeps an interior local change within one chunk', () => {
    expect(
      resolveDirtyChunks(
        { minVertexX: 8, minVertexZ: 8, maxVertexX: 8, maxVertexZ: 8 },
        WORLD_CONFIG,
      ),
    ).toEqual([{ x: 0, z: 0 }]);
  });

  it('returns deterministic row-major order at a four-chunk corner', () => {
    expect(
      resolveDirtyChunks(
        { minVertexX: 16, minVertexZ: 16, maxVertexX: 16, maxVertexZ: 16 },
        WORLD_CONFIG,
      ),
    ).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ]);
  });
});
