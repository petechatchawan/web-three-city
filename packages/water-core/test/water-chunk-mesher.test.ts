import { createWaterFixture } from '@web-three-city/shared-testkit';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildWaterChunkMesh, deriveWaterSnapshot, type WaterChunkMeshData } from '../src/index.js';

function waterFor(name: Parameters<typeof createWaterFixture>[0]) {
  const fixture = createWaterFixture(name);
  const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return { fixture, water: result.value };
}

function uniqueBoundaryZ(mesh: WaterChunkMeshData, worldX: number): number[] {
  const result = new Set<number>();
  for (let index = 0; index < mesh.surfacePositions.length; index += 3) {
    if (Math.abs(mesh.surfacePositions[index]! - worldX) <= 1e-9) {
      result.add(mesh.surfacePositions[index + 2]!);
    }
  }
  return [...result].sort((first, second) => first - second);
}

describe('buildWaterChunkMesh', () => {
  it('builds finite upward-facing Uint16 geometry', () => {
    const { fixture, water } = waterFor('water-chunk-seam');
    const mesh = buildWaterChunkMesh(fixture.terrain, water, { x: 3, z: 6 }, WORLD_CONFIG);
    expect(mesh.surfaceIndices).toBeInstanceOf(Uint16Array);
    expect([...mesh.surfacePositions].every(Number.isFinite)).toBe(true);
    expect([...mesh.shorelinePositions].every(Number.isFinite)).toBe(true);
    expect(mesh.surfaceTriangleCount).toBe(mesh.surfaceIndices.length / 3);
    for (let index = 1; index < mesh.surfaceNormals.length; index += 3) {
      expect(mesh.surfaceNormals[index]).toBe(1);
    }
    for (const index of mesh.surfaceIndices) {
      expect(index).toBeLessThan(mesh.surfacePositions.length / 3);
    }
  });

  it('preserves exact surface vertices across a chunk seam', () => {
    const { fixture, water } = waterFor('water-chunk-seam');
    const west = buildWaterChunkMesh(fixture.terrain, water, { x: 3, z: 6 }, WORLD_CONFIG);
    const east = buildWaterChunkMesh(fixture.terrain, water, { x: 4, z: 6 }, WORLD_CONFIG);
    expect(uniqueBoundaryZ(west, 0)).toEqual(uniqueBoundaryZ(east, 0));
    expect(uniqueBoundaryZ(west, 0).length).toBeGreaterThan(0);
  });

  it('uses upward triangle winding', () => {
    const { fixture, water } = waterFor('water-bay');
    const mesh = buildWaterChunkMesh(fixture.terrain, water, { x: 3, z: 6 }, WORLD_CONFIG);
    for (let offset = 0; offset < mesh.surfaceIndices.length; offset += 3) {
      const ia = mesh.surfaceIndices[offset]! * 3;
      const ib = mesh.surfaceIndices[offset + 1]! * 3;
      const ic = mesh.surfaceIndices[offset + 2]! * 3;
      const ax = mesh.surfacePositions[ia]!;
      const az = mesh.surfacePositions[ia + 2]!;
      const bx = mesh.surfacePositions[ib]!;
      const bz = mesh.surfacePositions[ib + 2]!;
      const cx = mesh.surfacePositions[ic]!;
      const cz = mesh.surfacePositions[ic + 2]!;
      const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      expect(normalY).toBeGreaterThan(0);
    }
  });

  it('contains shallow and deep vertex colors', () => {
    const { fixture, water } = waterFor('water-straight-coast');
    const shallow = buildWaterChunkMesh(fixture.terrain, water, { x: 3, z: 6 }, WORLD_CONFIG);
    const deep = buildWaterChunkMesh(fixture.terrain, water, { x: 3, z: 7 }, WORLD_CONFIG);
    expect([...shallow.surfaceColors].some((value) => Math.abs(value - 0.36) < 1e-6)).toBe(true);
    expect([...deep.surfaceColors].some((value) => Math.abs(value - 0.06) < 1e-6)).toBe(true);
  });

  it('rejects stale Water', () => {
    const { fixture, water } = waterFor('water-bay');
    expect(() =>
      buildWaterChunkMesh({ ...fixture.terrain, revision: 2 }, water, { x: 0, z: 0 }, WORLD_CONFIG),
    ).toThrowError(expect.objectContaining({ code: 'water:terrain-revision-mismatch' }));
  });
});
