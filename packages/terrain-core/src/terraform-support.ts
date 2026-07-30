import type { WorldConfig } from '@web-three-city/world-core';
import type { TerrainSnapshot } from './terrain-map.js';
import type { TerraformStrokeInput } from './terraform-contracts.js';
import {
  propagateTerraformSupport as propagateValidatedTerrainSupport,
  type TerraformSupportResult,
} from './terraform-support-propagation.js';
import type { CellCoord } from '@web-three-city/world-core';

function validTerrainSnapshot(terrain: TerrainSnapshot, config: WorldConfig): boolean {
  if (
    terrain.width !== config.mapWidth ||
    terrain.height !== config.mapHeight ||
    terrain.heightLevels.length !== (config.mapWidth + 1) * (config.mapHeight + 1) ||
    !Number.isInteger(terrain.revision) ||
    terrain.revision < 0
  ) {
    return false;
  }
  for (const level of terrain.heightLevels) {
    if (
      !Number.isInteger(level) ||
      level < config.minHeightLevel ||
      level > config.maxHeightLevel
    ) {
      return false;
    }
  }
  return true;
}

export function propagateTerraformSupport(
  terrain: TerrainSnapshot,
  input: TerraformStrokeInput,
  coreCells: readonly CellCoord[],
  config: WorldConfig,
): TerraformSupportResult {
  if (!validTerrainSnapshot(terrain, config)) {
    return Object.freeze({
      proposedHeightLevels: terrain.heightLevels.slice(),
      coreVertices: Object.freeze([]),
      supportVertices: Object.freeze([]),
      affectedVertices: Object.freeze([]),
      supportCells: Object.freeze([]),
      valid: false,
      invalidReason: 'terraform:invalid-terrain',
    });
  }
  return propagateValidatedTerrainSupport(terrain, input, coreCells, config);
}

export type { TerraformSupportResult } from './terraform-support-propagation.js';
