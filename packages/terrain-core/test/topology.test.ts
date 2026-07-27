import { describe, expect, it } from 'vitest';
import { CELL_TRIANGLES, selectTerrainDiagonal } from '../src/topology.js';

describe('accepted terrain diagonal', () => {
  it.each([
    [{ nw: 0, ne: 1, sw: 1, se: 2 }, 'sw-ne'],
    [{ nw: 2, ne: 1, sw: 0, se: 2 }, 'nw-se'],
    [{ nw: 1, ne: 0, sw: 0, se: 1 }, 'sw-ne'],
    [{ nw: 0, ne: 1, sw: 1, se: 0 }, 'sw-ne'],
    [{ nw: 0, ne: 4, sw: 1, se: 2 }, 'nw-se'],
    [{ nw: 0, ne: 3, sw: 1, se: 2 }, 'sw-ne'],
  ] as const)('selects the normative diagonal for %o', (corners, expected) => {
    expect(selectTerrainDiagonal(corners)).toBe(expected);
  });

  it('locks upward triangle corner order for both legal diagonals', () => {
    expect(CELL_TRIANGLES).toEqual({
      'sw-ne': [
        ['sw', 'se', 'ne'],
        ['sw', 'ne', 'nw'],
      ],
      'nw-se': [
        ['sw', 'se', 'nw'],
        ['se', 'ne', 'nw'],
      ],
    });
  });
});
