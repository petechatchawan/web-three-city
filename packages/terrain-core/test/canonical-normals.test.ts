import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildCanonicalNormals } from '../src/canonical-normals.js';
import { buildTerrainChunkMesh } from '../src/chunk-mesher.js';
import { createTerrainMap } from '../src/terrain-map.js';

describe('canonical seam normals', () => {
  it('copies identical positions and normals into adjacent chunk duplicates', () => {
    const levels = new Uint8Array(129 * 129).fill(2);
    for (let z = 0; z <= 128; z += 1) {
      for (let x = 16; x <= 128; x += 1) levels[z * 129 + x] = 3;
    }
    const map = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: levels,
      seed: 1,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 0,
    });
    const canonical = buildCanonicalNormals(map, WORLD_CONFIG);
    const west = buildTerrainChunkMesh(map, canonical, { x: 0, z: 0 }, WORLD_CONFIG);
    const east = buildTerrainChunkMesh(map, canonical, { x: 1, z: 0 }, WORLD_CONFIG);

    for (let localZ = 0; localZ <= 16; localZ += 1) {
      const westOffset = (localZ * 17 + 16) * 3;
      const eastOffset = localZ * 17 * 3;
      expect(Array.from(west.positions.slice(westOffset, westOffset + 3))).toEqual(
        Array.from(east.positions.slice(eastOffset, eastOffset + 3)),
      );
      for (let axis = 0; axis < 3; axis += 1) {
        expect(west.normals[westOffset + axis]).toBeCloseTo(east.normals[eastOffset + axis]!, 6);
      }
    }
  });
});
