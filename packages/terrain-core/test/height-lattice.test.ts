import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { HeightLattice } from '../src/height-lattice.js';

describe('HeightLattice', () => {
  it('stores one authoritative value per shared lattice vertex', () => {
    const lattice = HeightLattice.filled(WORLD_CONFIG, 2);

    expect(lattice.length).toBe(129 * 129);
    expect(lattice.get({ x: 128, z: 128 })).toBe(2);
  });

  it('uses copy-on-write mutation', () => {
    const before = HeightLattice.filled(WORLD_CONFIG, 2);
    const after = before.withHeight({ x: 8, z: 8 }, 3);

    expect(before.get({ x: 8, z: 8 })).toBe(2);
    expect(after.get({ x: 8, z: 8 })).toBe(3);
  });

  it('does not expose its internal byte array', () => {
    const lattice = HeightLattice.filled(WORLD_CONFIG, 2);
    const copy = lattice.toUint8Array();
    copy[0] = 4;

    expect(lattice.get({ x: 0, z: 0 })).toBe(2);
  });

  it('rejects heights outside the accepted range', () => {
    const lattice = HeightLattice.filled(WORLD_CONFIG, 2);

    expect(() => lattice.withHeight({ x: 0, z: 0 }, 5)).toThrowError(
      expect.objectContaining({ code: 'terrain:invalid-height-range' }),
    );
  });
});
