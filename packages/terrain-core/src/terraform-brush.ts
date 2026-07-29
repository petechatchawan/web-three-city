import { assertCellCoord, type CellCoord, type WorldConfig } from '@web-three-city/world-core';
import type { TerraformBrushSize } from './terraform-contracts.js';

function assertBrushSize(size: number): asserts size is TerraformBrushSize {
  if (size !== 1 && size !== 3 && size !== 5) {
    throw new RangeError('terraform:invalid-brush-size');
  }
}

export function expandTerraformBrushCells(
  center: CellCoord,
  brushSize: TerraformBrushSize,
  config: WorldConfig,
): readonly CellCoord[] {
  assertCellCoord(center, config);
  assertBrushSize(brushSize);

  const radius = (brushSize - 1) / 2;
  const minX = Math.max(0, center.x - radius);
  const maxX = Math.min(config.mapWidth - 1, center.x + radius);
  const minZ = Math.max(0, center.z - radius);
  const maxZ = Math.min(config.mapHeight - 1, center.z + radius);
  const cells: CellCoord[] = [];

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push(Object.freeze({ x, z }));
    }
  }

  return Object.freeze(cells);
}
