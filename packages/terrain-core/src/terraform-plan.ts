import { type CellCoord, type GridVertexCoord, type WorldConfig } from '@web-three-city/world-core';
import type { TerrainDirtyRegion } from './dirty-region.js';
import { createTerrainMap, type TerrainSnapshot } from './terrain-map.js';
import { expandTerraformBrushCells } from './terraform-brush.js';
import {
  TerraformContractError,
  type TerraformCommitResult,
  type TerraformInvalidReason,
  type TerraformPlan,
  type TerraformStrokeInput,
} from './terraform-contracts.js';
import { propagateTerraformSupport } from './terraform-support-propagation.js';

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

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < config.mapWidth &&
    cell.z < config.mapHeight
  );
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function coordinateOrder(
  first: Readonly<{ x: number; z: number }>,
  second: Readonly<{ x: number; z: number }>,
): number {
  return first.z - second.z || first.x - second.x;
}

function frozenCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  return Object.freeze(
    [...cells].map((cell) => Object.freeze({ x: cell.x, z: cell.z })).sort(coordinateOrder),
  );
}

function frozenVertices(vertices: Iterable<GridVertexCoord>): readonly GridVertexCoord[] {
  return Object.freeze(
    [...vertices]
      .map((vertex) => Object.freeze({ x: vertex.x, z: vertex.z }))
      .sort(coordinateOrder),
  );
}

function dirtyRegionFor(vertices: readonly GridVertexCoord[]): TerrainDirtyRegion {
  if (vertices.length === 0) {
    return Object.freeze({
      minVertexX: 0,
      minVertexZ: 0,
      maxVertexX: 0,
      maxVertexZ: 0,
    });
  }

  let minVertexX = Number.POSITIVE_INFINITY;
  let minVertexZ = Number.POSITIVE_INFINITY;
  let maxVertexX = Number.NEGATIVE_INFINITY;
  let maxVertexZ = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    minVertexX = Math.min(minVertexX, vertex.x);
    minVertexZ = Math.min(minVertexZ, vertex.z);
    maxVertexX = Math.max(maxVertexX, vertex.x);
    maxVertexZ = Math.max(maxVertexZ, vertex.z);
  }
  return Object.freeze({ minVertexX, minVertexZ, maxVertexX, maxVertexZ });
}

function hasInvalidCardinalDelta(levels: Uint8Array, config: WorldConfig): boolean {
  const width = config.mapWidth + 1;
  const height = config.mapHeight + 1;
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = z * width + x;
      if (x + 1 < width && Math.abs(levels[index]! - levels[index + 1]!) > 1) return true;
      if (z + 1 < height && Math.abs(levels[index]! - levels[index + width]!) > 1) {
        return true;
      }
    }
  }
  return false;
}

function validProposedLattice(levels: Uint8Array, config: WorldConfig): boolean {
  if (levels.length !== (config.mapWidth + 1) * (config.mapHeight + 1)) return false;
  for (const level of levels) {
    if (level < config.minHeightLevel || level > config.maxHeightLevel) return false;
  }
  return !hasInvalidCardinalDelta(levels, config);
}

function affectedCellsFor(
  input: TerraformStrokeInput,
  config: WorldConfig,
): Readonly<{ cells: readonly CellCoord[]; invalid: boolean }> {
  const cells = new Map<string, CellCoord>();
  for (const center of input.cells) {
    if (!validCell(center, config)) return { cells: Object.freeze([]), invalid: true };
    let footprint: readonly CellCoord[];
    try {
      footprint = expandTerraformBrushCells(center, input.brushSize, config);
    } catch {
      return { cells: Object.freeze([]), invalid: true };
    }
    for (const cell of footprint) cells.set(cellKey(cell), cell);
  }
  return { cells: frozenCells(cells.values()), invalid: false };
}

function changedVerticesBetween(
  base: Uint8Array,
  proposed: Uint8Array,
  config: WorldConfig,
): readonly GridVertexCoord[] {
  const result: GridVertexCoord[] = [];
  const width = config.mapWidth + 1;
  for (let index = 0; index < base.length; index += 1) {
    if (base[index] === proposed[index]) continue;
    result.push({ x: index % width, z: Math.floor(index / width) });
  }
  return frozenVertices(result);
}

export function planTerraformStroke(
  terrain: TerrainSnapshot,
  input: TerraformStrokeInput,
  config: WorldConfig,
): TerraformPlan {
  let invalidReason: TerraformInvalidReason | null = null;
  if (!validTerrainSnapshot(terrain, config)) invalidReason = 'terraform:invalid-terrain';

  const affected = affectedCellsFor(input, config);
  if (invalidReason === null && affected.invalid) invalidReason = 'terraform:invalid-cell';
  const coreCells = affected.cells;
  const support =
    invalidReason === null ? propagateTerraformSupport(terrain, input, coreCells, config) : null;
  const proposedHeightLevels = support?.proposedHeightLevels ?? terrain.heightLevels.slice();
  if (invalidReason === null && support !== null && !support.valid) {
    invalidReason = support.invalidReason;
  }

  const supportCells = support?.supportCells ?? Object.freeze([]);
  const affectedCellMap = new Map<string, CellCoord>();
  for (const cell of [...coreCells, ...supportCells]) affectedCellMap.set(cellKey(cell), cell);
  const affectedCells = frozenCells(affectedCellMap.values());
  const coreVertices = support?.coreVertices ?? Object.freeze([]);
  const supportVertices = support?.supportVertices ?? Object.freeze([]);
  const affectedVertices = support?.affectedVertices ?? Object.freeze([]);
  const changedVertices = changedVerticesBetween(
    terrain.heightLevels,
    proposedHeightLevels,
    config,
  );
  const changedVertexCount = changedVertices.length;

  if (invalidReason === null && hasInvalidCardinalDelta(proposedHeightLevels, config)) {
    invalidReason = 'terraform:cardinal-delta';
  }
  if (invalidReason === null && changedVertexCount === 0) invalidReason = 'terraform:no-change';

  return Object.freeze({
    operation: input.operation,
    brushSize: input.brushSize,
    baseTerrainRevision: terrain.revision,
    coreCells,
    supportCells,
    affectedCells,
    coreVertices,
    supportVertices,
    affectedVertices,
    proposedHeightLevels,
    changedVertexCount,
    dirtyRegion: dirtyRegionFor(changedVertices),
    valid: invalidReason === null,
    invalidReason,
  });
}

export function commitTerraformPlan(
  terrain: TerrainSnapshot,
  plan: TerraformPlan,
  config: WorldConfig,
): TerraformCommitResult {
  if (!plan.valid || plan.invalidReason !== null || plan.changedVertexCount <= 0) {
    throw new TerraformContractError('terraform:invalid-plan');
  }
  if (terrain.revision !== plan.baseTerrainRevision) {
    throw new TerraformContractError('terraform:stale-plan');
  }
  if (
    !validTerrainSnapshot(terrain, config) ||
    !validProposedLattice(plan.proposedHeightLevels, config)
  ) {
    throw new TerraformContractError('terraform:invalid-proposed-lattice');
  }

  let changedVertexCount = 0;
  for (let index = 0; index < terrain.heightLevels.length; index += 1) {
    if (terrain.heightLevels[index] !== plan.proposedHeightLevels[index]) changedVertexCount += 1;
  }
  if (changedVertexCount !== plan.changedVertexCount) {
    throw new TerraformContractError('terraform:invalid-proposed-lattice');
  }

  const snapshot = createTerrainMap({
    config,
    heightLevels: plan.proposedHeightLevels,
    seed: terrain.seed,
    generatorVersion: terrain.generatorVersion,
    generationAttempt: terrain.generationAttempt,
    revision: terrain.revision + 1,
  });

  return Object.freeze({
    snapshot,
    receipt: Object.freeze({
      beforeRevision: terrain.revision,
      afterRevision: snapshot.revision,
      changedVertexCount,
      affectedCellCount: plan.affectedCells.length,
      dirtyRegion: Object.freeze({ ...plan.dirtyRegion }),
    }),
  });
}
