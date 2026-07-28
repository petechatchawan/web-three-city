import { createWaterFixture } from '@web-three-city/shared-testkit';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { expect, it } from 'vitest';
import { createCoreWaterPresentationSource } from '../src/index.js';

it('builds all 64 Water chunks and one wall in canonical order', () => {
  const fixture = createWaterFixture('water-straight-coast');
  const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const build = createCoreWaterPresentationSource(WORLD_CONFIG).buildAll(
    fixture.terrain,
    result.value,
  );
  expect(build.chunks).toHaveLength(64);
  expect(build.chunks[0]?.chunk).toEqual({ x: 0, z: 0 });
  expect(build.chunks.at(-1)?.chunk).toEqual({ x: 7, z: 7 });
  expect(build.wall.sourceTerrainRevision).toBe(fixture.terrain.revision);
});
