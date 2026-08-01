import type { CellCoord, GridVertexCoord } from '@web-three-city/world-core';
import type { TerrainDirtyRegion } from './dirty-region.js';
import type { TerrainSnapshot } from './terrain-map.js';

export type WorldToolMode = 'navigate' | 'raise' | 'lower' | 'flatten';

export type TerraformOperation = Exclude<WorldToolMode, 'navigate'>;

export type TerraformBrushSize = 1 | 3 | 5;

export type TerraformInvalidReason =
  | 'terraform:height-range'
  | 'terraform:cardinal-delta'
  | 'terraform:no-change'
  | 'terraform:invalid-cell'
  | 'terraform:invalid-terrain'
  | 'terraform:non-canonical-shape'
  | 'terraform:propagation-blocked'
  | 'terraform:propagation-limit';

export interface TerraformStrokeInput {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly cells: readonly CellCoord[];
  readonly flattenTargetLevel?: number;
}

export interface TerraformPlan {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly baseTerrainRevision: number;
  readonly coreCells: readonly CellCoord[];
  readonly supportCells: readonly CellCoord[];
  readonly affectedCells: readonly CellCoord[];
  readonly coreVertices: readonly GridVertexCoord[];
  readonly supportVertices: readonly GridVertexCoord[];
  readonly affectedVertices: readonly GridVertexCoord[];
  readonly proposedHeightLevels: Uint8Array;
  readonly changedVertexCount: number;
  readonly dirtyRegion: TerrainDirtyRegion;
  readonly valid: boolean;
  readonly invalidReason: TerraformInvalidReason | null;
}

export interface TerraformCommitReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly changedVertexCount: number;
  readonly affectedCellCount: number;
  readonly dirtyRegion: TerrainDirtyRegion;
}

export interface TerraformCommitResult {
  readonly snapshot: TerrainSnapshot;
  readonly receipt: TerraformCommitReceipt;
}

export type TerraformContractErrorCode =
  'terraform:invalid-plan' | 'terraform:stale-plan' | 'terraform:invalid-proposed-lattice';

export class TerraformContractError extends Error {
  readonly code: TerraformContractErrorCode;

  constructor(code: TerraformContractErrorCode) {
    super(code);
    this.name = 'TerraformContractError';
    this.code = code;
  }
}
