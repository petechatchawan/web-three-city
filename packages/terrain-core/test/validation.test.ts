import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { validateTerrainInput } from '../src/validation.js';

describe('terrain validation', () => {
  it('accepts a legal constant lattice', () => {
    const levels = new Uint8Array(129 * 129).fill(2);

    expect(validateTerrainInput(levels, WORLD_CONFIG)).toEqual([]);
  });

  it('rejects an invalid lattice length', () => {
    const issues = validateTerrainInput(new Uint8Array(4), WORLD_CONFIG);

    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'terrain:invalid-lattice-length' }),
    );
  });

  it('rejects non-integer and out-of-range source values before coercion', () => {
    const levels = Array.from({ length: 129 * 129 }, () => 2);
    levels[0] = 1.5;
    levels[1] = 5;

    const issues = validateTerrainInput(levels, WORLD_CONFIG);

    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'terrain:non-integer-height' }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'terrain:invalid-height-range' }),
    );
  });

  it('rejects cardinal neighbor deltas greater than one', () => {
    const levels = new Uint8Array(129 * 129).fill(2);
    levels[1] = 4;

    const issues = validateTerrainInput(levels, WORLD_CONFIG);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'terrain:neighbor-delta-exceeded',
        coordinate: { x: 0, z: 0 },
        neighbor: { x: 1, z: 0 },
      }),
    );
  });
});
