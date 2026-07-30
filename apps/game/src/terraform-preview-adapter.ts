import {
  expandTerraformBrushCells,
  type TerrainCorners,
  type TerrainSnapshot,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import {
  validateTerraformPreviewSceneModel,
  type ProjectedTerrainCell,
  type TerraformPreviewSceneModel,
} from '@web-three-city/terrain-three';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { projectTerraformWater } from './terraform-water-projection.js';
import type { TerraformStrokeSessionState } from './terraform-stroke-session.js';

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function levelAt(levels: Uint8Array, x: number, z: number, config: WorldConfig): number {
  return levels[z * (config.mapWidth + 1) + x]!;
}

function projectedCell(
  cell: CellCoord,
  levels: Uint8Array,
  config: WorldConfig,
): ProjectedTerrainCell {
  const corners: TerrainCorners = Object.freeze({
    nw: levelAt(levels, cell.x, cell.z, config),
    ne: levelAt(levels, cell.x + 1, cell.z, config),
    sw: levelAt(levels, cell.x, cell.z + 1, config),
    se: levelAt(levels, cell.x + 1, cell.z + 1, config),
  });
  return Object.freeze({
    cell: Object.freeze({ x: cell.x, z: cell.z }),
    corners,
  });
}

function projectedCells(
  cells: readonly CellCoord[],
  levels: Uint8Array,
  config: WorldConfig,
): readonly ProjectedTerrainCell[] {
  const unique = new Map<string, CellCoord>();
  for (const cell of cells) unique.set(cellKey(cell), cell);
  return Object.freeze(
    [...unique.values()]
      .sort((first, second) => first.z - second.z || first.x - second.x)
      .map((cell) => projectedCell(cell, levels, config)),
  );
}

function currentStampCells(
  state: TerraformStrokeSessionState,
  plan: TerraformPlan,
  config: WorldConfig,
): readonly CellCoord[] {
  if (state.currentStamp.kind !== 'rejected' && state.currentStamp.kind !== 'no-change') {
    return Object.freeze([]);
  }
  try {
    return expandTerraformBrushCells(state.currentStamp.anchor, state.brushSize, config);
  } catch {
    const accepted = new Set(state.acceptedPlan?.coreCells.map(cellKey) ?? []);
    return Object.freeze(plan.coreCells.filter((cell) => !accepted.has(cellKey(cell))));
  }
}

function emptyCells(): readonly CellCoord[] {
  return Object.freeze([]);
}

export function createTerraformPreviewSceneModel(
  state: TerraformStrokeSessionState,
  sourceTerrain: TerrainSnapshot,
  config: WorldConfig,
): TerraformPreviewSceneModel {
  const acceptedPlan = state.acceptedPlan;
  const acceptedCoreCells =
    acceptedPlan === null
      ? Object.freeze([])
      : projectedCells(acceptedPlan.coreCells, acceptedPlan.proposedHeightLevels, config);
  const propagatedSupportCells =
    acceptedPlan === null
      ? Object.freeze([])
      : projectedCells(acceptedPlan.supportCells, acceptedPlan.proposedHeightLevels, config);

  let rejectedStampCells: readonly ProjectedTerrainCell[] = Object.freeze([]);
  let noChangeCells: readonly ProjectedTerrainCell[] = Object.freeze([]);
  if (state.currentStamp.kind === 'rejected' || state.currentStamp.kind === 'no-change') {
    const previewPlan = state.currentStamp.preview.corePlan;
    const cells = currentStampCells(state, previewPlan, config);
    const projected = projectedCells(cells, previewPlan.proposedHeightLevels, config);
    if (state.currentStamp.kind === 'rejected') rejectedStampCells = projected;
    else noChangeCells = projected;
  }

  let projectedWetCells = emptyCells();
  let projectedDryCells = emptyCells();
  let projectedShorelineCells = emptyCells();
  if (acceptedPlan !== null) {
    const sourceWaterResult = deriveWaterSnapshot(sourceTerrain, config);
    if (!sourceWaterResult.ok) {
      throw new Error(`terraform-preview-adapter:water-derivation-failed:${sourceWaterResult.error.code}`);
    }
    const water = projectTerraformWater(
      sourceTerrain,
      sourceWaterResult.value,
      acceptedPlan,
      config,
    );
    projectedWetCells = water.projectedWetCells;
    projectedDryCells = water.projectedDryCells;
    projectedShorelineCells = water.projectedShorelineCells;
  }

  const model: TerraformPreviewSceneModel = Object.freeze({
    acceptedCoreCells,
    propagatedSupportCells,
    rejectedStampCells,
    noChangeCells,
    projectedWetCells,
    projectedDryCells,
    projectedShorelineCells,
  });
  validateTerraformPreviewSceneModel(model);
  return model;
}
