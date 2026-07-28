import {
  type CellCoord,
  type GridVertexCoord,
  type WorldConfig,
  vertexIndex,
} from '@web-three-city/world-core';
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

function cellKey(cell: CellCoord): number {
  return cell.z * 1_000_000 + cell.x;
}

function vertexKey(vertex: GridVertexCoord, config: WorldConfig): number {
  return vertex.z * (config.mapWidth + 1) + vertex.x;
}

function sortedCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  return Object.freeze(
    [...cells]
      .map((cell) => Object.freeze({ x: cell.x, z: cell.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function sortedVertices(vertices: Iterable<GridVertexCoord>): readonly GridVertexCoord[] {
  return Object.freeze(
    [...vertices]
      .map((vertex) => Object.freeze({ x: vertex.x, z: vertex.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
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
      if (x + 1 < width && Math.abs(levels[index]! - levels[index + 1]!) > 1) {
        return true;
      }
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
  const cells = new Map<number, CellCoord>();
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
  return { cells: sortedCells(cells.values()), invalid: false };
}

function affectedVerticesFor(
  cells: readonly CellCoord[],
  config: WorldConfig,
): readonly GridVertexCoord[] {
  const vertices = new Map<number, GridVertexCoord>();
  for (const cell of cells) {
    for (const vertex of [
      { x: cell.x, z: cell.z },
      { x: cell.x + 1, z: cell.z },
      { x: cell.x, z: cell.z + 1 },
      { x: cell.x + 1, z: cell.z + 1 },
    ]) {
      vertices.set(vertexKey(vertex, config), vertex);
    }
  }
  return sortedVertices(vertices.values());
}

function proposedLevel(base: number, input: TerraformStrokeInput): number {
  switch (input.operation) {
    case 'raise':
      return base + 1;
    case 'lower':
      return base - 1;
    case 'flatten':
      return input.flattenTargetLevel ?? Number.NaN;
  }
}

export function planTerraformStroke(
  terrain: TerrainSnapshot,
  input: TerraformStrokeInput,
  config: WorldConfig,
): TerraformPlan {
  const proposedHeightLevels = terrain.heightLevels.slice();
  let invalidReason: TerraformInvalidReason | null = null;

  if (!validTerrainSnapshot(terrain, config)) invalidReason = 'terraform:invalid-terrain';

  const affected = affectedCellsFor(input, config);
  if (invalidReason === null && affected.invalid) invalidReason = 'terraform:invalid-cell';
  const affectedCells = affected.cells;
  const affectedVertices = affectedVerticesFor(affectedCells, config);
  let changedVertexCount = 0;

  if (invalidReason === null) {
    for (const vertex of affectedVertices) {
      const index = vertexIndex(vertex, config);
      const base = terrain.heightLevels[index]!;
      const rawLevel = proposedLevel(base, input);
      if (
        !Number.isInteger(rawLevel) ||
        rawLevel < config.minHeightLevel ||
        rawLevel > config.maxHeightLevel
      ) {
        invalidReason = 'terraform:height-range';
        proposedHeightLevels[index] = Math.min(
          config.maxHeightLevel,
          Math.max(config.minHeightLevel, Number.isFinite(rawLevel) ? Math.round(rawLevel) : base),
        );
        continue;
      }
      proposedHeightLevels[index] = rawLevel;
      if (rawLevel !== base) changedVertexCount += 1;
    }
  }

  if (invalidReason === null && hasInvalidCardinalDelta(proposedHeightLevels, config)) {
    invalidReason = 'terraform:cardinal-delta';
  }
  if (invalidReason === null && changedVertexCount === 0) invalidReason = 'terraform:no-change';

  return Object.freeze({
    operation: input.operation,
    brushSize: input.brushSize,
    baseTerrainRevision: terrain.revision,
    affectedCells,
    affectedVertices,
    proposedHeightLevels,
    changedVertexCount,
    dirtyRegion: dirtyRegionFor(affectedVertices),
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
