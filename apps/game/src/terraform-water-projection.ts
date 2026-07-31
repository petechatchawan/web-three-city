import {
  createTerrainMap,
  type TerrainSnapshot,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import {
  deriveWaterSnapshot,
  triangleIndexFor,
  type WaterSnapshot,
} from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';

export type TerraformProjectedWaterState = 'dry' | 'wet' | 'shoreline';

export interface TerraformProjectedWaterSummary {
  readonly projectedWetCells: readonly CellCoord[];
  readonly projectedDryCells: readonly CellCoord[];
  readonly projectedShorelineCells: readonly CellCoord[];
  readonly newlyWetCells: readonly CellCoord[];
  readonly newlyDryCells: readonly CellCoord[];
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function sortedCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  return Object.freeze(
    [...cells]
      .map((cell) => Object.freeze({ x: cell.x, z: cell.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return cell.x >= 0 && cell.z >= 0 && cell.x < config.mapWidth && cell.z < config.mapHeight;
}

function stateAt(
  water: WaterSnapshot,
  cell: CellCoord,
  mapWidth: number,
): TerraformProjectedWaterState {
  const first = water.seaTriangleMask[triangleIndexFor(cell.x, cell.z, 0, mapWidth)]!;
  const second = water.seaTriangleMask[triangleIndexFor(cell.x, cell.z, 1, mapWidth)]!;
  if (first === 0 && second === 0) return 'dry';
  if (first === 1 && second === 1) return 'wet';
  return 'shoreline';
}

function latticeLevel(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function crossesSeaSurface(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  cell: CellCoord,
): boolean {
  const levels = [
    latticeLevel(terrain, cell.x, cell.z),
    latticeLevel(terrain, cell.x + 1, cell.z),
    latticeLevel(terrain, cell.x, cell.z + 1),
    latticeLevel(terrain, cell.x + 1, cell.z + 1),
  ];
  const hasSeaTriangle =
    water.seaTriangleMask[triangleIndexFor(cell.x, cell.z, 0, terrain.width)] === 1 ||
    water.seaTriangleMask[triangleIndexFor(cell.x, cell.z, 1, terrain.width)] === 1;
  return hasSeaTriangle && Math.min(...levels) <= water.seaLevel && Math.max(...levels) > water.seaLevel;
}

function touchesProjectedShoreline(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  cell: CellCoord,
  config: WorldConfig,
): boolean {
  const state = stateAt(water, cell, config.mapWidth);
  if (state === 'shoreline' || crossesSeaSurface(terrain, water, cell)) return true;

  for (const neighbor of [
    { x: cell.x, z: cell.z - 1 },
    { x: cell.x + 1, z: cell.z },
    { x: cell.x, z: cell.z + 1 },
    { x: cell.x - 1, z: cell.z },
  ]) {
    if (validCell(neighbor, config) && stateAt(water, neighbor, config.mapWidth) !== state) {
      return true;
    }
  }
  return false;
}

export function projectTerraformWater(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  plan: TerraformPlan,
  config: WorldConfig,
): TerraformProjectedWaterSummary {
  if (!plan.valid || plan.invalidReason !== null || plan.baseTerrainRevision !== terrain.revision) {
    throw new RangeError('terraform-water-projection:invalid-plan');
  }
  if (
    water.width !== config.mapWidth ||
    water.height !== config.mapHeight ||
    water.sourceTerrainRevision !== terrain.revision
  ) {
    throw new RangeError('terraform-water-projection:incoherent-source');
  }

  const projectedTerrain = createTerrainMap({
    config,
    heightLevels: plan.proposedHeightLevels,
    seed: terrain.seed,
    generatorVersion: terrain.generatorVersion,
    generationAttempt: terrain.generationAttempt,
    revision: terrain.revision,
  });
  const projectedResult = deriveWaterSnapshot(projectedTerrain, config);
  if (!projectedResult.ok) {
    throw new Error(`terraform-water-projection:derivation-failed:${projectedResult.error.code}`);
  }
  const projectedWater = projectedResult.value;

  const candidates = new Map<string, CellCoord>();
  for (const cell of plan.affectedCells) {
    for (const candidate of [
      cell,
      { x: cell.x, z: cell.z - 1 },
      { x: cell.x + 1, z: cell.z },
      { x: cell.x, z: cell.z + 1 },
      { x: cell.x - 1, z: cell.z },
    ]) {
      if (validCell(candidate, config)) candidates.set(cellKey(candidate), candidate);
    }
  }

  const projectedWetCells: CellCoord[] = [];
  const projectedDryCells: CellCoord[] = [];
  const projectedShorelineCells: CellCoord[] = [];
  const newlyWetCells: CellCoord[] = [];
  const newlyDryCells: CellCoord[] = [];

  for (const cell of candidates.values()) {
    const sourceState = stateAt(water, cell, config.mapWidth);
    const projectedState = stateAt(projectedWater, cell, config.mapWidth);
    if (projectedState === 'wet') projectedWetCells.push(cell);
    else if (projectedState === 'dry') projectedDryCells.push(cell);
    else projectedShorelineCells.push(cell);
    if (
      projectedState !== 'shoreline' &&
      touchesProjectedShoreline(projectedTerrain, projectedWater, cell, config)
    ) {
      projectedShorelineCells.push(cell);
    }
    if (projectedState === 'wet' && sourceState !== 'wet') newlyWetCells.push(cell);
    if (projectedState === 'dry' && sourceState !== 'dry') newlyDryCells.push(cell);
  }

  return Object.freeze({
    projectedWetCells: sortedCells(projectedWetCells),
    projectedDryCells: sortedCells(projectedDryCells),
    projectedShorelineCells: sortedCells(projectedShorelineCells),
    newlyWetCells: sortedCells(newlyWetCells),
    newlyDryCells: sortedCells(newlyDryCells),
  });
}
