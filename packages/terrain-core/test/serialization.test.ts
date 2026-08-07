import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createTerrainMap } from '../src/terrain-map.js';
import { decodeTerrainSaveV1, encodeTerrainSaveV1 } from '../src/serialization.js';

describe('terrain serialization', () => {
  it('preserves the canonical TerrainSaveV1 base64 wire representation without DOM codecs', () => {
    const levels = new Uint8Array(129 * 129).fill(2);
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      seed: 1,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 0,
      heightLevels: levels,
    });

    expect(encodeTerrainSaveV1(map).heightLevels).toBe('AgIC'.repeat((129 * 129) / 3));
  });

  it('round-trips byte-identical lattice data', () => {
    const levels = new Uint8Array(129 * 129).fill(2);
    levels[0] = 1;
    levels[128] = 3;
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      seed: 1464156977,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 7,
      heightLevels: levels,
    });

    const decoded = decodeTerrainSaveV1(encodeTerrainSaveV1(map));

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.heightLevels).toEqual(map.heightLevels);
    expect(decoded.value.revision).toBe(7);
  });

  it('copies caller-owned source bytes when creating a map', () => {
    const levels = new Uint8Array(129 * 129).fill(2);
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      seed: 1,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 0,
      heightLevels: levels,
    });
    levels[0] = 4;

    expect(map.heightLevels[0]).toBe(2);
  });

  it('rejects mismatched dimensions before decoding bytes', () => {
    const result = decodeTerrainSaveV1({
      schemaVersion: 1,
      generatorVersion: 'coastal-v1',
      width: 64,
      height: 128,
      seed: 1,
      generationAttempt: 0,
      revision: 0,
      heightLevels: 'not-base64',
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'terrain-save:invalid-dimensions' }),
    });
  });

  it('rejects corrupted encoded data without constructing terrain state', () => {
    const result = decodeTerrainSaveV1({
      schemaVersion: 1,
      generatorVersion: 'coastal-v1',
      width: 128,
      height: 128,
      seed: 1,
      generationAttempt: 0,
      revision: 0,
      heightLevels: 'not-base64',
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'terrain-save:invalid-base64' }),
    });
  });
});
