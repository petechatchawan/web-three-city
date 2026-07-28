import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { WATER_FIXTURE_NAMES, createWaterFixture } from '../src/index.js';

describe('Water fixtures', () => {
  it.each(WATER_FIXTURE_NAMES)('constructs %s deterministically', (name) => {
    const first = createWaterFixture(name);
    const second = createWaterFixture(name);
    expect(first.terrain.width).toBe(WORLD_CONFIG.mapWidth);
    expect(first.terrain.height).toBe(WORLD_CONFIG.mapHeight);
    expect(first.terrain.heightLevels).toEqual(second.terrain.heightLevels);
    expect(first.terrain.seed).toBe(second.terrain.seed);
    expect(first.terrain.revision).toBe(1);
  });
});
