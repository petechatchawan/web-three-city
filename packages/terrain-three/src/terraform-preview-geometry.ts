import {
  CELL_TRIANGLES,
  selectTerrainDiagonal,
  type TerrainCorner,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';

const PREVIEW_Y_OFFSET = 0.03;
const VALID_COLOR = [0.2, 0.9, 0.42] as const;
const INVALID_COLOR = [0.95, 0.22, 0.2] as const;

export interface TerraformPreviewMeshData {
  readonly positions: Float32Array;
  readonly colors: readonly number[];
  readonly indices: Uint16Array;
  readonly cellCount: number;
  readonly valid: boolean;
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

function levelAt(plan: TerraformPlan, x: number, z: number, config: WorldConfig): number {
  return plan.proposedHeightLevels[z * (config.mapWidth + 1) + x]!;
}

export function buildTerraformPreviewMesh(
  plan: TerraformPlan,
  config: WorldConfig,
): TerraformPreviewMeshData {
  const expectedLength = (config.mapWidth + 1) * (config.mapHeight + 1);
  if (plan.proposedHeightLevels.length !== expectedLength) {
    throw new RangeError('terraform-preview:invalid-lattice');
  }
  if (plan.affectedCells.length * 4 > 65_536) {
    throw new RangeError('terraform-preview:vertex-capacity-exceeded');
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = plan.valid ? VALID_COLOR : INVALID_COLOR;

  for (const cell of plan.affectedCells) {
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

    const corners = {
      nw: levelAt(plan, cell.x, cell.z, config),
      ne: levelAt(plan, cell.x + 1, cell.z, config),
      sw: levelAt(plan, cell.x, cell.z + 1, config),
      se: levelAt(plan, cell.x + 1, cell.z + 1, config),
    };
    const base = positions.length / 3;

    for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
      const offset = CORNER_OFFSETS[corner];
      positions.push(
        (cell.x + offset.x - config.mapWidth / 2) * config.cellSize,
        corners[corner] * config.heightStep + PREVIEW_Y_OFFSET,
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

  if (!positions.every(Number.isFinite)) {
    throw new RangeError('terraform-preview:non-finite-geometry');
  }

  return Object.freeze({
    positions: new Float32Array(positions),
    colors: Object.freeze(colors),
    indices: new Uint16Array(indices),
    cellCount: plan.affectedCells.length,
    valid: plan.valid,
  });
}
