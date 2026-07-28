import { describe, expect, it } from 'vitest';
import { rasterizeTerraformCellLine } from '../src/index.js';

describe('rasterizeTerraformCellLine', () => {
  it('returns one cell for a zero-length stroke', () => {
    expect(rasterizeTerraformCellLine({ x: 3, z: 7 }, { x: 3, z: 7 })).toEqual([
      { x: 3, z: 7 },
    ]);
  });

  it('fills a fast horizontal drag without holes', () => {
    expect(rasterizeTerraformCellLine({ x: 2, z: 4 }, { x: 6, z: 4 })).toEqual([
      { x: 2, z: 4 },
      { x: 3, z: 4 },
      { x: 4, z: 4 },
      { x: 5, z: 4 },
      { x: 6, z: 4 },
    ]);
  });

  it('fills a fast vertical drag without holes', () => {
    expect(rasterizeTerraformCellLine({ x: 8, z: 5 }, { x: 8, z: 2 })).toEqual([
      { x: 8, z: 5 },
      { x: 8, z: 4 },
      { x: 8, z: 3 },
      { x: 8, z: 2 },
    ]);
  });

  it('uses deterministic supercover cells for a diagonal drag', () => {
    expect(rasterizeTerraformCellLine({ x: 1, z: 1 }, { x: 4, z: 3 })).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 2, z: 2 },
      { x: 3, z: 2 },
      { x: 4, z: 2 },
      { x: 4, z: 3 },
    ]);
  });

  it('is directionally reversible', () => {
    const forward = rasterizeTerraformCellLine({ x: 2, z: 9 }, { x: 6, z: 6 });
    const backward = rasterizeTerraformCellLine({ x: 6, z: 6 }, { x: 2, z: 9 });
    expect(backward).toEqual([...forward].reverse());
  });
});
