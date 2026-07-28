import { createWaterFixture } from '@web-three-city/shared-testkit';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { deriveWaterSnapshot, triangleIndexFor } from '../src/index.js';

describe('triangleIndexFor', () => {
  it('uses z-major cell order and canonical local triangle order', () => {
    expect(triangleIndexFor(0, 0, 0, 128)).toBe(0);
    expect(triangleIndexFor(0, 0, 1, 128)).toBe(1);
    expect(triangleIndexFor(1, 0, 0, 128)).toBe(2);
    expect(triangleIndexFor(0, 1, 0, 128)).toBe(256);
  });
});

describe('deriveWaterSnapshot', () => {
  it('leaves an enclosed basin unrendered', () => {
    const fixture = createWaterFixture('water-enclosed-basin');
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount).toBe(0);
    expect(result.value.enclosedWetTriangleCount).toBeGreaterThan(0);
  });

  it('connects the same basin through a positive-width channel', () => {
    const fixture = createWaterFixture('water-open-channel');
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount).toBeGreaterThan(0);
    expect(result.value.enclosedWetTriangleCount).toBe(0);
  });

  it('keeps corner-only contact disconnected', () => {
    const fixture = createWaterFixture('water-corner-contact');
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount).toBeGreaterThan(0);
    expect(result.value.enclosedWetTriangleCount).toBeGreaterThan(0);
  });

  it.each(['water-diagonal-sw-ne', 'water-diagonal-nw-se'] as const)(
    'derives canonical topology for %s',
    (name) => {
      const fixture = createWaterFixture(name);
      const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.seaTriangleCount).toBeGreaterThan(0);
    },
  );

  it.each([
    'water-straight-coast',
    'water-diagonal-sw-ne',
    'water-diagonal-nw-se',
    'water-bay',
    'water-peninsula',
    'water-chunk-seam',
    'water-enclosed-basin',
    'water-open-channel',
    'water-corner-contact',
    'water-south-wall',
  ] as const)('matches locked fixture counts for %s', (name) => {
    const fixture = createWaterFixture(name);
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount).toBe(fixture.expectedSeaTriangleCount);
    expect(result.value.enclosedWetTriangleCount).toBe(fixture.expectedEnclosedWetTriangleCount);
  });

  it('is byte-deterministic', () => {
    const fixture = createWaterFixture('water-bay');
    const first = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    const second = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(first).toEqual(second);
  });

  it.each([
    [
      { ...createWaterFixture('water-straight-coast').terrain, width: 127 },
      'water:invalid-terrain-dimensions',
    ],
    [
      {
        ...createWaterFixture('water-straight-coast').terrain,
        heightLevels: new Uint8Array(1),
      },
      'water:invalid-height-lattice',
    ],
    [
      { ...createWaterFixture('water-straight-coast').terrain, revision: -1 },
      'water:invalid-terrain-revision',
    ],
  ] as const)('rejects invalid Terrain with %s', (terrain, code) => {
    const result = deriveWaterSnapshot(terrain as TerrainSnapshot, WORLD_CONFIG);
    expect(result).toEqual(expect.objectContaining({ ok: false, error: { code } }));
  });

  it('rejects an invalid sea level', () => {
    const fixture = createWaterFixture('water-straight-coast');
    const result = deriveWaterSnapshot(fixture.terrain, {
      ...WORLD_CONFIG,
      seaLevel: WORLD_CONFIG.maxHeightLevel + 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'water:invalid-sea-level' } });
  });
});
