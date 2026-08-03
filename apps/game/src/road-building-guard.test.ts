import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { guardRoadPlanWithBuildings } from './road-building-guard.js';

describe('road building guard', () => {
  it('rejects Road placement over Building occupancy before core commit', () => {
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
    const candidate = {
      valid: true,
      invalidReason: null,
      corePlan: { operation: 'build', addedCells: [{ x: 2, z: 2 }] },
      previewPlan: { valid: true },
      blockedZoneCells: [],
    } as unknown as Parameters<typeof guardRoadPlanWithBuildings>[0];
    const result = guardRoadPlanWithBuildings(
      candidate,
      {} as never,
      buildings,
      {} as never,
      {} as never,
      {} as never,
      WORLD_CONFIG,
    );
    expect(result).toMatchObject({ valid: false, invalidReason: 'road:building-occupied' });
  });
});
