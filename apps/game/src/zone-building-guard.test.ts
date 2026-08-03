import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { guardZonePlanWithBuildings } from './zone-building-guard.js';

describe('zone building guard', () => {
  it('rejects removal beneath an existing building', () => {
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
      changedCells: [{ x: 2, z: 2 }],
    } as unknown as Parameters<typeof guardZonePlanWithBuildings>[0];
    expect(guardZonePlanWithBuildings(plan, buildings)).toMatchObject({
      valid: false,
      invalidReason: 'zone:building-occupied',
    });
  });
});
