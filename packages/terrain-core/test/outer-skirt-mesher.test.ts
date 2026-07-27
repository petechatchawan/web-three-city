import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildOuterSkirtMesh } from '../src/outer-skirt-mesher.js';
import { createTerrainMap } from '../src/terrain-map.js';

describe('outer diorama skirt', () => {
  it('emits exactly 512 boundary segments and no bottom cap', () => {
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: new Uint8Array(129 * 129).fill(2),
      seed: 1,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 0,
    });
    const skirt = buildOuterSkirtMesh(map, WORLD_CONFIG);

    expect(skirt.segmentCount).toBe(128 * 4);
    expect(skirt.positions.length / 3).toBe(128 * 4 * 4);
    expect(skirt.indices.length / 3).toBe(128 * 4 * 2);
    for (let index = 1; index < skirt.positions.length; index += 3) {
      const y = skirt.positions[index]!;
      expect(y === 1 || y === -1.5).toBe(true);
    }
  });

  it('is byte-deterministic and uses hard side normals', () => {
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: new Uint8Array(129 * 129).fill(2),
      seed: 1,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 0,
    });
    const first = buildOuterSkirtMesh(map, WORLD_CONFIG);
    const second = buildOuterSkirtMesh(map, WORLD_CONFIG);

    expect(first.positions).toEqual(second.positions);
    expect(first.indices).toEqual(second.indices);
    expect(new Set(Array.from(first.normals))).toEqual(new Set([-1, 0, 1]));
  });
});
