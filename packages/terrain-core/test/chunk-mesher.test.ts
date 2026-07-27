import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createTerrainMap } from '../src/terrain-map.js';
import { buildCanonicalNormals } from '../src/canonical-normals.js';
import { buildTerrainChunkMesh } from '../src/chunk-mesher.js';

function flatMap() {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(129 * 129).fill(2),
    seed: 1,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
  });
}

describe('terrain chunk mesher', () => {
  it('emits 17x17 vertices and exactly two triangles per cell', () => {
    const map = flatMap();
    const normals = buildCanonicalNormals(map, WORLD_CONFIG);
    const mesh = buildTerrainChunkMesh(map, normals, { x: 0, z: 0 }, WORLD_CONFIG);

    expect(mesh.positions.length / 3).toBe(17 * 17);
    expect(mesh.normals.length / 3).toBe(17 * 17);
    expect(mesh.colors.length / 3).toBe(17 * 17);
    expect(mesh.indices.length).toBe(16 * 16 * 6);
    expect(Array.from(mesh.indices.slice(0, 6))).toEqual([17, 18, 1, 17, 1, 0]);
  });

  it('emits only non-degenerate upward-wound top triangles', () => {
    const map = flatMap();
    const mesh = buildTerrainChunkMesh(
      map,
      buildCanonicalNormals(map, WORLD_CONFIG),
      { x: 0, z: 0 },
      WORLD_CONFIG,
    );

    for (let offset = 0; offset < mesh.indices.length; offset += 3) {
      const a = mesh.indices[offset]! * 3;
      const b = mesh.indices[offset + 1]! * 3;
      const c = mesh.indices[offset + 2]! * 3;
      const abx = mesh.positions[b]! - mesh.positions[a]!;
      const aby = mesh.positions[b + 1]! - mesh.positions[a + 1]!;
      const abz = mesh.positions[b + 2]! - mesh.positions[a + 2]!;
      const acx = mesh.positions[c]! - mesh.positions[a]!;
      const acy = mesh.positions[c + 1]! - mesh.positions[a + 1]!;
      const acz = mesh.positions[c + 2]! - mesh.positions[a + 2]!;
      const crossY = abz * acx - abx * acz;
      const areaSquared = (aby * acz - abz * acy) ** 2 + crossY ** 2 + (abx * acy - aby * acx) ** 2;

      expect(crossY).toBeGreaterThan(0);
      expect(areaSquared).toBeGreaterThan(0);
    }
  });
});
