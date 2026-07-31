import {
  createTerrainMap,
  planTerraformStroke,
  type TerrainSnapshot,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { projectTerraformWater } from './terraform-water-projection.js';

const TEST_CONFIG: WorldConfig = Object.freeze({
  mapWidth: 4,
  mapHeight: 4,
  chunkSize: 2,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1,
});

function uniformTerrain(level: number): TerrainSnapshot {
  return createTerrainMap({
    config: TEST_CONFIG,
    heightLevels: new Uint8Array(25).fill(level),
    seed: 41,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 3,
  });
}

function waterFor(terrain: TerrainSnapshot): WaterSnapshot {
  const result = deriveWaterSnapshot(terrain, TEST_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

function latticeIndex(x: number, z: number): number {
  return z * (TEST_CONFIG.mapWidth + 1) + x;
}

function mixedTriangleShorelinePlan(terrain: TerrainSnapshot): TerraformPlan {
  const basePlan = planTerraformStroke(
    terrain,
    { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 3 }] },
    TEST_CONFIG,
  );
  const proposedHeightLevels = terrain.heightLevels.slice();
  proposedHeightLevels[latticeIndex(1, 3)] = 2;
  proposedHeightLevels[latticeIndex(2, 3)] = 2;
  proposedHeightLevels[latticeIndex(1, 4)] = 2;
  proposedHeightLevels[latticeIndex(2, 4)] = 1;
  return Object.freeze({
    ...basePlan,
    affectedCells: Object.freeze([{ x: 1, z: 3 }]),
    proposedHeightLevels,
  });
}

describe('projectTerraformWater', () => {
  it('classifies newly exposed dry cells from the projected lattice', () => {
    const terrain = uniformTerrain(1);
    const water = waterFor(terrain);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 3 }] },
      TEST_CONFIG,
    );

    const summary = projectTerraformWater(terrain, water, plan, TEST_CONFIG);

    expect(summary.newlyDryCells).toContainEqual({ x: 1, z: 3 });
    expect(summary.projectedDryCells).toContainEqual({ x: 1, z: 3 });
  });

  it('classifies one ocean-connected projected triangle as shoreline', () => {
    const terrain = uniformTerrain(1);
    const water = waterFor(terrain);
    const plan = mixedTriangleShorelinePlan(terrain);

    const summary = projectTerraformWater(terrain, water, plan, TEST_CONFIG);

    expect(summary.projectedShorelineCells).toContainEqual({ x: 1, z: 3 });
    expect(summary.projectedWetCells).not.toContainEqual({ x: 1, z: 3 });
    expect(summary.projectedDryCells).not.toContainEqual({ x: 1, z: 3 });
  });

  it('classifies newly wet cells after lowering south-edge terrain', () => {
    const terrain = uniformTerrain(2);
    const water = waterFor(terrain);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'lower', brushSize: 1, cells: [{ x: 1, z: 3 }] },
      TEST_CONFIG,
    );

    const summary = projectTerraformWater(terrain, water, plan, TEST_CONFIG);

    expect(summary.newlyWetCells).toContainEqual({ x: 1, z: 3 });
    expect(summary.projectedWetCells).toContainEqual({ x: 1, z: 3 });
  });

  it('does not mutate the source Terrain or Water masks', () => {
    const terrain = uniformTerrain(1);
    const water = waterFor(terrain);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 3 }] },
      TEST_CONFIG,
    );
    const beforeLevels = terrain.heightLevels.slice();
    const beforeMask = water.seaTriangleMask.slice();

    projectTerraformWater(terrain, water, plan, TEST_CONFIG);

    expect(terrain.heightLevels).toEqual(beforeLevels);
    expect(water.seaTriangleMask).toEqual(beforeMask);
  });

  it('rejects invalid or stale Terraform plans', () => {
    const terrain = uniformTerrain(1);
    const water = waterFor(terrain);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 3 }] },
      TEST_CONFIG,
    );

    expect(() =>
      projectTerraformWater(
        terrain,
        { ...water, seaTriangleMask: water.seaTriangleMask.slice() },
        { ...plan, baseTerrainRevision: plan.baseTerrainRevision + 1 },
        TEST_CONFIG,
      ),
    ).toThrow('terraform-water-projection:invalid-plan');
  });
});
