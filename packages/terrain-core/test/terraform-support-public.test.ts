import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createTerrainMap, propagateTerraformSupport, type TerrainSnapshot } from '../src/index.js';

describe('public propagateTerraformSupport contract', () => {
  it('returns terraform:invalid-terrain for a malformed direct-call snapshot', () => {
    const valid = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
        1,
      ),
      seed: 71,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 2,
    });
    const malformed = Object.freeze({
      ...valid,
      heightLevels: new Uint8Array([1, 1, 1]),
    }) as TerrainSnapshot;

    expect(
      propagateTerraformSupport(
        malformed,
        { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 1 }] },
        [{ x: 1, z: 1 }],
        WORLD_CONFIG,
      ),
    ).toMatchObject({ valid: false, invalidReason: 'terraform:invalid-terrain' });
  });
});
