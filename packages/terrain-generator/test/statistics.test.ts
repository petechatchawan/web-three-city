import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { calculateTerrainStatistics } from '../src/statistics.js';

describe('terrain statistics', () => {
  it('classifies a constant level-2 map as dry, flat, and buildable', () => {
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: new Uint8Array(129 * 129).fill(2),
      seed: 1,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 0,
    });

    const statistics = calculateTerrainStatistics(map, WORLD_CONFIG);

    expect(statistics).toMatchObject({
      fullyDryCellCount: 128 * 128,
      fullyWaterCellCount: 0,
      shorelineCellCount: 0,
      flatBuildableCellCount: 128 * 128,
      largestBuildableSquare: 128,
      largestLandmassCellCount: 128 * 128,
      maxCardinalVertexDelta: 0,
      isolatedSpikeCount: 0,
      isolatedPitCount: 0,
    });
  });
});
