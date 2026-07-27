import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { generateCoastalTerrain } from '../src/coastal-generator.js';
import { calculateTerrainStatistics } from '../src/statistics.js';

describe('Constraint-Aware Coastal Generator v1', () => {
  it('is byte-deterministic for the curated seed', () => {
    const first = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
    const second = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.heightLevels).toEqual(second.value.heightLevels);
      expect(first.value.generationAttempt).toBe(second.value.generationAttempt);
    }
  });

  it('meets every locked generation constraint', () => {
    const result = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const statistics = calculateTerrainStatistics(result.value, WORLD_CONFIG);

    expect(statistics.fullyWaterRatio).toBeGreaterThanOrEqual(0.18);
    expect(statistics.fullyWaterRatio).toBeLessThanOrEqual(0.22);
    expect(statistics.largestLandmassRatio).toBeGreaterThanOrEqual(0.72);
    expect(statistics.flatBuildableRatio).toBeGreaterThanOrEqual(0.3);
    expect(statistics.largestBuildableSquare).toBeGreaterThanOrEqual(24);
    expect(statistics.level4PlateauRatio).toBeLessThanOrEqual(0.12);
    expect(statistics.isolatedSpikeCount).toBe(0);
    expect(statistics.isolatedPitCount).toBe(0);
    expect(statistics.maxCardinalVertexDelta).toBeLessThanOrEqual(1);
  });
});
