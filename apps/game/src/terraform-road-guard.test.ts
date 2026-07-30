import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
} from '@web-three-city/road-core';
import { createTerrainMap, planTerraformStroke } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { guardTerraformPlanWithRoads } from './terraform-road-guard.js';

const LATTICE_LENGTH = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

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

function roadsAt(x: number, z: number) {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  codes[z * WORLD_CONFIG.mapWidth + x] = BASIC_ROAD_CODE;
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

describe('Terraform Road guard', () => {
  it('marks the complete valid plan and Preview invalid when any affected cell has a Road', () => {
    const corePlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 3, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    expect(corePlan.valid).toBe(true);

    const guarded = guardTerraformPlanWithRoads(corePlan, roadsAt(9, 8));

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe('terraform:road-occupied');
    expect(guarded.corePlan).toBe(corePlan);
    expect(guarded.previewPlan.valid).toBe(false);
    expect(guarded.previewPlan.affectedCells).toEqual(corePlan.affectedCells);
    expect(corePlan.valid).toBe(true);
  });

  it('preserves valid plans without overlapping Roads', () => {
    const corePlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    const guarded = guardTerraformPlanWithRoads(
      corePlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
    );

    expect(guarded).toMatchObject({ valid: true, invalidReason: null });
    expect(guarded.previewPlan).toBe(corePlan);
  });

  it('preserves Terrain-owned invalid reasons without replacing them', () => {
    const corePlan = planTerraformStroke(
      terrain(),
      { operation: 'flatten', brushSize: 1, cells: [{ x: 8, z: 8 }], flattenTargetLevel: 2 },
      WORLD_CONFIG,
    );
    expect(corePlan.valid).toBe(false);

    const guarded = guardTerraformPlanWithRoads(corePlan, roadsAt(8, 8));

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe(corePlan.invalidReason);
    expect(guarded.previewPlan).toBe(corePlan);
  });
});
