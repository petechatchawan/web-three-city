import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { guardTerraformPlanWithOccupancy } from './terraform-occupancy-guard.js';

describe('terraform building occupancy', () => {
  it('rejects vertices touching an occupied Building cell', () => {
    const buildings = createBuildingSnapshot(
      {
        revision: 1,
        instances: [
          {
            instanceId: 'b',
            buildingDefinitionId: 'residential-cottage-1x1',
            buildingDefinitionVersion: 1,
            originCell: { x: 2, z: 2 },
            rotationQuarterTurns: 0,
          },
        ],
      },
      WORLD_CONFIG,
    );
    const plan = {
      valid: true,
      invalidReason: null,
      affectedVertices: [{ x: 2, z: 2 }],
    } as unknown as Parameters<typeof guardTerraformPlanWithOccupancy>[0];
    expect(
      guardTerraformPlanWithOccupancy(
        plan,
        createEmptyRoadSnapshot(WORLD_CONFIG),
        createEmptyZoneSnapshot(WORLD_CONFIG),
        buildings,
      ),
    ).toMatchObject({ valid: false, invalidReason: 'terraform:building-occupied' });
  });
});
