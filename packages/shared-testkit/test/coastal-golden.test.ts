import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/hash.js';

describe('Coastal Generator v1 golden output', () => {
  it('locks the curated seed, attempt, and lattice bytes', async () => {
    const result = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.generationAttempt).toBe(0);
    await expect(sha256Hex(result.value.heightLevels)).resolves.toBe(
      'cf04c9c74a8d3520195c8a5b5324f09aeb1a50bda9902e39faa8b24b6f4f492e',
    );
  });
});
