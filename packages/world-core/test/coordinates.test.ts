import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '../src/config.js';
import { cellIndex, vertexIndex, vertexToWorld, worldToCell } from '../src/coordinates.js';

describe('world coordinate contracts', () => {
  it('uses row-major cell and lattice indexing', () => {
    expect(cellIndex({ x: 3, z: 2 }, WORLD_CONFIG)).toBe(259);
    expect(vertexIndex({ x: 3, z: 2 }, WORLD_CONFIG)).toBe(261);
  });

  it('centers lattice vertex 64,64 at the scene origin', () => {
    expect(vertexToWorld({ x: 64, z: 64 }, 2, WORLD_CONFIG)).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
  });

  it('maps world positions into their containing cells', () => {
    expect(worldToCell({ x: -63.25, y: 0, z: -62.75 }, WORLD_CONFIG)).toEqual({
      x: 0,
      z: 1,
    });
  });

  it('rejects positions outside the map instead of clamping', () => {
    expect(() => worldToCell({ x: -65, y: 0, z: 0 }, WORLD_CONFIG)).toThrowError(
      expect.objectContaining({ code: 'world:outside-map' }),
    );
    expect(() => worldToCell({ x: 64, y: 0, z: 0 }, WORLD_CONFIG)).toThrowError(
      expect.objectContaining({ code: 'world:outside-map' }),
    );
  });

  it('rejects non-integer grid coordinates', () => {
    expect(() => cellIndex({ x: 1.5, z: 2 }, WORLD_CONFIG)).toThrowError(
      expect.objectContaining({ code: 'world:invalid-cell-coordinate' }),
    );
  });
});
