import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { guardZonePlanWithBuildings } from './zone-building-guard.js';

function buildings() {
  return createBuildingSnapshot(
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
}

describe('zone building guard', () => {
  it('rejects a valid Zone change that intersects an existing Building', () => {
    const plan = {
      valid: true,
      invalidReason: null,
      requestedCells: [{ x: 2, z: 2 }],
      changedCells: [{ x: 2, z: 2 }],
    } as unknown as Parameters<typeof guardZonePlanWithBuildings>[0];

    expect(guardZonePlanWithBuildings(plan, buildings())).toMatchObject({
      valid: false,
      invalidReason: 'zone:building-occupied',
      blockedBuildingCells: [{ x: 2, z: 2 }],
    });
  });

  it('overrides the generic core occupancy reason using requested Building cells', () => {
    const plan = {
      valid: false,
      invalidReason: 'zone:occupied',
      requestedCells: [{ x: 2, z: 2 }],
      changedCells: [],
    } as unknown as Parameters<typeof guardZonePlanWithBuildings>[0];

    expect(guardZonePlanWithBuildings(plan, buildings())).toMatchObject({
      valid: false,
      invalidReason: 'zone:building-occupied',
      blockedBuildingCells: [{ x: 2, z: 2 }],
    });
  });
});
