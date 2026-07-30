import { describe, expect, it } from 'vitest';
import {
  validateTerraformPreviewSceneModel,
  type TerraformPreviewSceneModel,
} from '../src/index.js';

function projectedCell(x: number, z: number, level = 1) {
  return Object.freeze({
    cell: Object.freeze({ x, z }),
    corners: Object.freeze({ nw: level, ne: level, sw: level, se: level }),
  });
}

function emptyModel(): TerraformPreviewSceneModel {
  return {
    acceptedCoreCells: [],
    propagatedSupportCells: [],
    rejectedStampCells: [],
    noChangeCells: [],
    projectedWetCells: [],
    projectedDryCells: [],
    projectedShorelineCells: [],
  };
}

describe('validateTerraformPreviewSceneModel', () => {
  it('rejects duplicate cells across core and support layers', () => {
    expect(() =>
      validateTerraformPreviewSceneModel({
        ...emptyModel(),
        acceptedCoreCells: [projectedCell(2, 3)],
        propagatedSupportCells: [projectedCell(2, 3)],
      }),
    ).toThrow('terraform-preview-model:duplicate-semantic-cell');
  });

  it('requires finite projected corner levels', () => {
    expect(() =>
      validateTerraformPreviewSceneModel({
        ...emptyModel(),
        acceptedCoreCells: [
          {
            cell: { x: 1, z: 1 },
            corners: { nw: Number.NaN, ne: 1, sw: 1, se: 1 },
          },
        ],
      }),
    ).toThrow('terraform-preview-model:non-finite-corner');
  });

  it('accepts a rejected stamp overlapping an accepted footprint', () => {
    expect(() =>
      validateTerraformPreviewSceneModel({
        ...emptyModel(),
        acceptedCoreCells: [projectedCell(1, 1)],
        rejectedStampCells: [projectedCell(1, 1, 2)],
      }),
    ).not.toThrow();
  });
});
