import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
} from '@web-three-city/road-core';
import { createTerrainMap, planTerraformStroke } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  RESIDENTIAL_ZONE_CODE,
  createEmptyZoneSnapshot,
  createZoneSnapshot,
} from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { guardTerraformPlanWithOccupancy } from './terraform-occupancy-guard.js';

const LATTICE_LENGTH = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);
const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function terrain() {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_LENGTH).fill(2),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 4,
  });
}

function roadsAt(...cells: readonly CellCoord[]) {
  const codes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 2,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function zonesAt(...cells: readonly CellCoord[]) {
  const codes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = RESIDENTIAL_ZONE_CODE;
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 3,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('Terraform occupancy guard', () => {
  it('returns sorted Road and Zone cells sharing affected Terrain vertices', () => {
    const corePlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    const guarded = guardTerraformPlanWithOccupancy(
      corePlan,
      roadsAt({ x: 9, z: 8 }),
      zonesAt({ x: 8, z: 9 }, { x: 7, z: 7 }),
    );

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe('terraform:road-occupied');
    expect(guarded.blockedRoadCells).toEqual([{ x: 9, z: 8 }]);
    expect(guarded.blockedZoneCells).toEqual([
      { x: 7, z: 7 },
      { x: 8, z: 9 },
    ]);
    expect(guarded.corePlan).toBe(corePlan);
    expect(guarded.previewPlan.valid).toBe(false);
    expect(corePlan.valid).toBe(true);
  });

  it('uses the Zone reason when no Road blocks the plan', () => {
    const corePlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    const guarded = guardTerraformPlanWithOccupancy(
      corePlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      zonesAt({ x: 9, z: 8 }),
    );

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe('terraform:zone-occupied');
    expect(guarded.blockedRoadCells).toEqual([]);
    expect(guarded.blockedZoneCells).toEqual([{ x: 9, z: 8 }]);
  });

  it('preserves valid and Terrain-owned invalid plans unchanged', () => {
    const validPlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    const valid = guardTerraformPlanWithOccupancy(
      validPlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      createEmptyZoneSnapshot(WORLD_CONFIG),
    );
    expect(valid).toMatchObject({
      valid: true,
      invalidReason: null,
      blockedRoadCells: [],
      blockedZoneCells: [],
    });
    expect(valid.previewPlan).toBe(validPlan);

    const invalidPlan = planTerraformStroke(
      terrain(),
      { operation: 'flatten', brushSize: 1, cells: [{ x: 8, z: 8 }], flattenTargetLevel: 2 },
      WORLD_CONFIG,
    );
    const invalid = guardTerraformPlanWithOccupancy(
      invalidPlan,
      roadsAt({ x: 8, z: 8 }),
      zonesAt({ x: 8, z: 8 }),
    );
    expect(invalid.invalidReason).toBe(invalidPlan.invalidReason);
    expect(invalid.blockedRoadCells).toEqual([]);
    expect(invalid.blockedZoneCells).toEqual([]);
    expect(invalid.previewPlan).toBe(invalidPlan);
  });
});
