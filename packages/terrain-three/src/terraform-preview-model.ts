import type { TerrainCorners } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';

export interface ProjectedTerrainCell {
  readonly cell: CellCoord;
  readonly corners: TerrainCorners;
}

export interface TerraformPreviewSceneModel {
  readonly acceptedCoreCells: readonly ProjectedTerrainCell[];
  readonly propagatedSupportCells: readonly ProjectedTerrainCell[];
  readonly rejectedStampCells: readonly ProjectedTerrainCell[];
  readonly noChangeCells: readonly ProjectedTerrainCell[];
  readonly projectedWetCells: readonly CellCoord[];
  readonly projectedDryCells: readonly CellCoord[];
  readonly projectedShorelineCells: readonly CellCoord[];
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function validateProjectedCells(cells: readonly ProjectedTerrainCell[]): void {
  const seen = new Set<string>();
  for (const projected of cells) {
    if (!Number.isInteger(projected.cell.x) || !Number.isInteger(projected.cell.z)) {
      throw new RangeError('terraform-preview-model:invalid-cell');
    }
    const key = cellKey(projected.cell);
    if (seen.has(key)) throw new RangeError('terraform-preview-model:duplicate-layer-cell');
    seen.add(key);
    for (const value of Object.values(projected.corners)) {
      if (!Number.isFinite(value)) {
        throw new RangeError('terraform-preview-model:non-finite-corner');
      }
    }
  }
}

function validateCellCoords(cells: readonly CellCoord[]): void {
  const seen = new Set<string>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.z)) {
      throw new RangeError('terraform-preview-model:invalid-cell');
    }
    const key = cellKey(cell);
    if (seen.has(key)) throw new RangeError('terraform-preview-model:duplicate-layer-cell');
    seen.add(key);
  }
}

export function validateTerraformPreviewSceneModel(model: TerraformPreviewSceneModel): void {
  validateProjectedCells(model.acceptedCoreCells);
  validateProjectedCells(model.propagatedSupportCells);
  validateProjectedCells(model.rejectedStampCells);
  validateProjectedCells(model.noChangeCells);
  validateCellCoords(model.projectedWetCells);
  validateCellCoords(model.projectedDryCells);
  validateCellCoords(model.projectedShorelineCells);

  const coreKeys = new Set(model.acceptedCoreCells.map((projected) => cellKey(projected.cell)));
  if (model.propagatedSupportCells.some((projected) => coreKeys.has(cellKey(projected.cell)))) {
    throw new RangeError('terraform-preview-model:duplicate-semantic-cell');
  }
}

export function terraformPreviewModelEmpty(model: TerraformPreviewSceneModel): boolean {
  return (
    model.acceptedCoreCells.length === 0 &&
    model.propagatedSupportCells.length === 0 &&
    model.rejectedStampCells.length === 0 &&
    model.noChangeCells.length === 0 &&
    model.projectedWetCells.length === 0 &&
    model.projectedDryCells.length === 0 &&
    model.projectedShorelineCells.length === 0
  );
}
