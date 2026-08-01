import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  TERRAFORM_PREVIEW_Y_OFFSET,
  buildTerraformPreviewMesh,
  type ProjectedTerrainCell,
  type TerraformPreviewSceneModel,
} from '../src/index.js';

function projectedCell(x: number, z: number, level = 1): ProjectedTerrainCell {
  return Object.freeze({
    cell: Object.freeze({ x, z }),
    corners: Object.freeze({ nw: level, ne: level, sw: level, se: level }),
  });
}

function model(overrides: Partial<TerraformPreviewSceneModel> = {}): TerraformPreviewSceneModel {
  return {
    acceptedCoreCells: [],
    propagatedSupportCells: [],
    rejectedStampCells: [],
    noChangeCells: [],
    projectedWetCells: [],
    projectedDryCells: [],
    projectedShorelineCells: [],
    ...overrides,
  };
}

function expectFloat32Color(actual: Float32Array, expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((component, index) => {
    expect(actual[index]!).toBeCloseTo(component, 5);
  });
}

describe('buildTerraformPreviewMesh', () => {
  it('builds exactly two canonical triangles for one accepted core cell', () => {
    const data = buildTerraformPreviewMesh(
      model({ acceptedCoreCells: [projectedCell(10, 10)] }),
      WORLD_CONFIG,
    );

    expect(data.core.cellCount).toBe(1);
    expect(data.core.positions).toHaveLength(12);
    expect(data.core.colors).toHaveLength(12);
    expect(data.core.indices).toHaveLength(6);
    expect(data.core.indices).toBeInstanceOf(Uint32Array);
    for (let index = 1; index < data.core.positions.length; index += 3) {
      expect(data.core.positions[index]).toBeCloseTo(
        WORLD_CONFIG.heightStep + TERRAFORM_PREVIEW_Y_OFFSET,
        5,
      );
    }
  });

  it('keeps accepted, support, rejected, and no-change colors in separate buffers', () => {
    const data = buildTerraformPreviewMesh(
      model({
        acceptedCoreCells: [projectedCell(10, 10)],
        propagatedSupportCells: [projectedCell(11, 10)],
        rejectedStampCells: [projectedCell(12, 10)],
        noChangeCells: [projectedCell(13, 10)],
      }),
      WORLD_CONFIG,
    );

    expectFloat32Color(data.core.colors.slice(0, 3), [0.2, 0.9, 0.42]);
    expectFloat32Color(data.support.colors.slice(0, 3), [0.94, 0.72, 0.2]);
    expectFloat32Color(data.rejected.colors.slice(0, 3), [0.95, 0.22, 0.2]);
    expectFloat32Color(data.noChange.colors.slice(0, 3), [0.78, 0.82, 0.84]);
  });

  it('emits finite geometry for multiple semantic and Water cells', () => {
    const data = buildTerraformPreviewMesh(
      model({
        acceptedCoreCells: [projectedCell(10, 10), projectedCell(11, 10)],
        propagatedSupportCells: [projectedCell(12, 10)],
        projectedWetCells: [{ x: 10, z: 11 }],
        projectedDryCells: [{ x: 11, z: 11 }],
        projectedShorelineCells: [{ x: 12, z: 11 }],
      }),
      WORLD_CONFIG,
    );

    expect(data.core.cellCount).toBe(2);
    expect(data.support.cellCount).toBe(1);
    expect(data.water.cellCount).toBe(3);
    for (const layer of Object.values(data)) {
      expect([...layer.positions].every(Number.isFinite)).toBe(true);
    }
  });

  it('rejects an out-of-bounds projected cell', () => {
    expect(() =>
      buildTerraformPreviewMesh(model({ acceptedCoreCells: [projectedCell(-1, 0)] }), WORLD_CONFIG),
    ).toThrowError('terraform-preview:invalid-cell');
  });
});
