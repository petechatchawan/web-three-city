import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { expandTerraformBrushCells } from '../src/index.js';

describe('expandTerraformBrushCells', () => {
  it.each([
    [1, 1],
    [3, 9],
    [5, 25],
  ] as const)('expands size %s to %s centered cells', (size, count) => {
    expect(expandTerraformBrushCells({ x: 64, z: 64 }, size, WORLD_CONFIG)).toHaveLength(count);
  });

  it('returns cells in deterministic z-major/x-major order', () => {
    expect(expandTerraformBrushCells({ x: 5, z: 5 }, 3, WORLD_CONFIG)).toEqual([
      { x: 4, z: 4 },
      { x: 5, z: 4 },
      { x: 6, z: 4 },
      { x: 4, z: 5 },
      { x: 5, z: 5 },
      { x: 6, z: 5 },
      { x: 4, z: 6 },
      { x: 5, z: 6 },
      { x: 6, z: 6 },
    ]);
  });

  it('clips a 5x5 brush at the north-west boundary', () => {
    expect(expandTerraformBrushCells({ x: 0, z: 0 }, 5, WORLD_CONFIG)).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 0, z: 2 },
      { x: 1, z: 2 },
      { x: 2, z: 2 },
    ]);
  });

  it('rejects unsupported brush sizes', () => {
    expect(() => expandTerraformBrushCells({ x: 4, z: 4 }, 2 as 1, WORLD_CONFIG)).toThrowError(
      'terraform:invalid-brush-size',
    );
  });
});
