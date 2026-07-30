import {
  CELL_TRIANGLES,
  selectTerrainDiagonal,
  type TerrainCorner,
  type TerrainCorners,
} from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  validateTerraformPreviewSceneModel,
  type ProjectedTerrainCell,
  type TerraformPreviewSceneModel,
} from './terraform-preview-model.js';

export const TERRAFORM_PREVIEW_Y_OFFSET = 0.03;

const CORE_COLOR = [0.2, 0.9, 0.42] as const;
const SUPPORT_COLOR = [0.94, 0.72, 0.2] as const;
const REJECTED_COLOR = [0.95, 0.22, 0.2] as const;
const NO_CHANGE_COLOR = [0.78, 0.82, 0.84] as const;
const WET_COLOR = [0.18, 0.56, 0.92] as const;
const DRY_COLOR = [0.64, 0.88, 0.94] as const;
const SHORELINE_COLOR = [0.18, 0.82, 0.86] as const;

export interface TerraformPreviewLayerMeshData {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly cellCount: number;
}

export interface TerraformPreviewMeshData {
  readonly core: TerraformPreviewLayerMeshData;
  readonly support: TerraformPreviewLayerMeshData;
  readonly rejected: TerraformPreviewLayerMeshData;
  readonly noChange: TerraformPreviewLayerMeshData;
  readonly water: TerraformPreviewLayerMeshData;
}

const CORNER_OFFSETS: Readonly<Record<TerrainCorner, Readonly<{ x: number; z: number }>>> =
  Object.freeze({
    nw: Object.freeze({ x: 0, z: 0 }),
    ne: Object.freeze({ x: 1, z: 0 }),
    sw: Object.freeze({ x: 0, z: 1 }),
    se: Object.freeze({ x: 1, z: 1 }),
  });

const CORNER_LOCAL_INDEX: Readonly<Record<TerrainCorner, number>> = Object.freeze({
  nw: 0,
  ne: 1,
  sw: 2,
  se: 3,
});

function validateCell(cell: CellCoord, config: WorldConfig): void {
  if (
    !Number.isInteger(cell.x) ||
    !Number.isInteger(cell.z) ||
    cell.x < 0 ||
    cell.z < 0 ||
    cell.x >= config.mapWidth ||
    cell.z >= config.mapHeight
  ) {
    throw new RangeError('terraform-preview:invalid-cell');
  }
}

function emptyLayer(): TerraformPreviewLayerMeshData {
  return Object.freeze({
    positions: new Float32Array(),
    colors: new Float32Array(),
    indices: new Uint32Array(),
    cellCount: 0,
  });
}

function appendCell(
  positions: number[],
  colors: number[],
  indices: number[],
  cell: CellCoord,
  corners: TerrainCorners,
  color: readonly [number, number, number],
  config: WorldConfig,
): void {
  validateCell(cell, config);
  const base = positions.length / 3;
  for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
    const offset = CORNER_OFFSETS[corner];
    positions.push(
      (cell.x + offset.x - config.mapWidth / 2) * config.cellSize,
      corners[corner] * config.heightStep + TERRAFORM_PREVIEW_Y_OFFSET,
      (cell.z + offset.z - config.mapHeight / 2) * config.cellSize,
    );
    colors.push(...color);
  }
  for (const triangle of CELL_TRIANGLES[selectTerrainDiagonal(corners)]) {
    indices.push(
      base + CORNER_LOCAL_INDEX[triangle[0]],
      base + CORNER_LOCAL_INDEX[triangle[1]],
      base + CORNER_LOCAL_INDEX[triangle[2]],
    );
  }
}

function projectedLayer(
  cells: readonly ProjectedTerrainCell[],
  color: readonly [number, number, number],
  config: WorldConfig,
): TerraformPreviewLayerMeshData {
  if (cells.length === 0) return emptyLayer();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const projected of cells) {
    appendCell(positions, colors, indices, projected.cell, projected.corners, color, config);
  }
  if (!positions.every(Number.isFinite)) {
    throw new RangeError('terraform-preview:non-finite-geometry');
  }
  return Object.freeze({
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    cellCount: cells.length,
  });
}

function appendWaterCell(
  positions: number[],
  colors: number[],
  indices: number[],
  cell: CellCoord,
  color: readonly [number, number, number],
  config: WorldConfig,
): void {
  const sea = config.seaLevel;
  appendCell(
    positions,
    colors,
    indices,
    cell,
    { nw: sea, ne: sea, sw: sea, se: sea },
    color,
    config,
  );
}

function waterLayer(
  model: TerraformPreviewSceneModel,
  config: WorldConfig,
): TerraformPreviewLayerMeshData {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const cell of model.projectedWetCells) {
    appendWaterCell(positions, colors, indices, cell, WET_COLOR, config);
  }
  for (const cell of model.projectedDryCells) {
    appendWaterCell(positions, colors, indices, cell, DRY_COLOR, config);
  }
  for (const cell of model.projectedShorelineCells) {
    appendWaterCell(positions, colors, indices, cell, SHORELINE_COLOR, config);
  }
  const cellCount =
    model.projectedWetCells.length +
    model.projectedDryCells.length +
    model.projectedShorelineCells.length;
  if (cellCount === 0) return emptyLayer();
  return Object.freeze({
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    cellCount,
  });
}

export function buildTerraformPreviewMesh(
  model: TerraformPreviewSceneModel,
  config: WorldConfig,
): TerraformPreviewMeshData {
  validateTerraformPreviewSceneModel(model);
  return Object.freeze({
    core: projectedLayer(model.acceptedCoreCells, CORE_COLOR, config),
    support: projectedLayer(model.propagatedSupportCells, SUPPORT_COLOR, config),
    rejected: projectedLayer(model.rejectedStampCells, REJECTED_COLOR, config),
    noChange: projectedLayer(model.noChangeCells, NO_CHANGE_COLOR, config),
    water: waterLayer(model, config),
  });
}
