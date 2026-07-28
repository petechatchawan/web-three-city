import { createWaterFixture } from '@web-three-city/shared-testkit';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildWaterWallMesh, deriveWaterSnapshot } from '../src/index.js';

function wallFor(name: Parameters<typeof createWaterFixture>[0]) {
  const fixture = createWaterFixture(name);
  const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return buildWaterWallMesh(fixture.terrain, result.value, WORLD_CONFIG);
}

describe('buildWaterWallMesh', () => {
  it('builds only connected south intervals to the diorama base', () => {
    const wall = wallFor('water-south-wall');
    expect(wall.segmentCount).toBe(2);
    expect(wall.bounds.min.y).toBe(WORLD_CONFIG.dioramaBaseY);
    expect(wall.bounds.max.y).toBeCloseTo(0.51, 8);
    expect([...wall.positions].every(Number.isFinite)).toBe(true);
    expect(wall.indices).toBeInstanceOf(Uint16Array);
  });

  it('emits no wall behind south-boundary land', () => {
    const wall = wallFor('water-enclosed-basin');
    expect(wall.segmentCount).toBe(0);
    expect(wall.indices).toHaveLength(0);
  });

  it('uses outward south normals and never overshoots Water Y', () => {
    const wall = wallFor('water-straight-coast');
    for (let index = 0; index < wall.normals.length; index += 3) {
      expect([...wall.normals.slice(index, index + 3)]).toEqual([0, 0, 1]);
    }
    for (let index = 1; index < wall.positions.length; index += 3) {
      expect(wall.positions[index]).toBeLessThanOrEqual(0.51 + 1e-9);
    }
  });
});
