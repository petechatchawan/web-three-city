import type { TerraformPlan } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildTerraformPreviewMesh } from '../src/index.js';

function plan(valid: boolean, cells = [{ x: 10, z: 10 }]): TerraformPlan {
  return {
    operation: 'raise',
    brushSize: 1,
    baseTerrainRevision: 1,
    affectedCells: cells,
    affectedVertices: [
      { x: 10, z: 10 },
      { x: 11, z: 10 },
      { x: 10, z: 11 },
      { x: 11, z: 11 },
    ],
    proposedHeightLevels: new Uint8Array(
      (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1),
    ).fill(1),
    changedVertexCount: valid ? 4 : 0,
    dirtyRegion: {
      minVertexX: 10,
      minVertexZ: 10,
      maxVertexX: 11,
      maxVertexZ: 11,
    },
    valid,
    invalidReason: valid ? null : 'terraform:height-range',
  };
}

describe('buildTerraformPreviewMesh', () => {
  it('builds exactly two canonical triangles for one affected cell', () => {
    const data = buildTerraformPreviewMesh(plan(true), WORLD_CONFIG);

    expect(data.cellCount).toBe(1);
    expect(data.positions).toHaveLength(12);
    expect(data.colors).toHaveLength(12);
    expect(data.indices).toHaveLength(6);
    expect(data.indices).toBeInstanceOf(Uint16Array);
    for (let index = 1; index < data.positions.length; index += 3) {
      expect(data.positions[index]).toBeCloseTo(0.53, 8);
    }
  });

  it('uses valid green and invalid red vertex colors', () => {
    expect([...buildTerraformPreviewMesh(plan(true), WORLD_CONFIG).colors.slice(0, 3)]).toEqual(
      [0.2, 0.9, 0.42],
    );
    expect([...buildTerraformPreviewMesh(plan(false), WORLD_CONFIG).colors.slice(0, 3)]).toEqual(
      [0.95, 0.22, 0.2],
    );
  });

  it('emits finite upward-facing geometry for multiple cells', () => {
    const data = buildTerraformPreviewMesh(
      plan(true, [
        { x: 10, z: 10 },
        { x: 11, z: 10 },
      ]),
      WORLD_CONFIG,
    );

    expect(data.cellCount).toBe(2);
    expect([...data.positions].every(Number.isFinite)).toBe(true);
    for (let offset = 0; offset < data.indices.length; offset += 3) {
      const ia = data.indices[offset]! * 3;
      const ib = data.indices[offset + 1]! * 3;
      const ic = data.indices[offset + 2]! * 3;
      const ax = data.positions[ia]!;
      const az = data.positions[ia + 2]!;
      const bx = data.positions[ib]!;
      const bz = data.positions[ib + 2]!;
      const cx = data.positions[ic]!;
      const cz = data.positions[ic + 2]!;
      const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      expect(normalY).toBeGreaterThan(0);
    }
  });

  it('rejects an invalid proposed lattice length', () => {
    expect(() =>
      buildTerraformPreviewMesh(
        { ...plan(true), proposedHeightLevels: new Uint8Array(1) },
        WORLD_CONFIG,
      ),
    ).toThrowError('terraform-preview:invalid-lattice');
  });
});
