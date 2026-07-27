import { describe, expect, it } from 'vitest';
import { SHAPE_ATLAS_FIXTURES, TOPOLOGY_CASES } from '../src/index.js';

describe('shared deterministic fixtures', () => {
  it('provides all twelve authored Shape Atlas matrices', () => {
    expect(SHAPE_ATLAS_FIXTURES).toHaveLength(12);
    expect(SHAPE_ATLAS_FIXTURES.map((fixture) => fixture.id)).toEqual([
      'F-01',
      'F-02',
      'F-03',
      'F-04',
      'F-05',
      'F-06',
      'F-07',
      'F-08',
      'F-09',
      'F-10',
      'F-11',
      'F-12',
    ]);
    expect(SHAPE_ATLAS_FIXTURES.every((fixture) => fixture.heightLevels.length === 64)).toBe(true);
  });

  it('covers every accepted diagonal decision branch', () => {
    expect(TOPOLOGY_CASES).toHaveLength(6);
  });
});
