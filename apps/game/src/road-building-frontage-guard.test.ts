import { createBuildingSnapshot } from '@web-three-city/building-core';
import { BASIC_ROAD_CODE, createRoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { COMMERCIAL_ZONE_CODE, createZoneSnapshot } from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { guardRoadPlanWithBuildings } from './road-building-guard.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;
const LATTICE_COUNT = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function index(x: number, z: number): number {
  return z * WORLD_CONFIG.mapWidth + x;
}

describe('required Building frontage guard', () => {
  it('rejects Road bulldoze that removes the Building’s last deterministic frontage', () => {
    const terrain = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: new Uint8Array(LATTICE_COUNT).fill(2),
      seed: 1_464_156_977,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 4,
    });
    const waterResult = deriveWaterSnapshot(terrain, WORLD_CONFIG);
    if (!waterResult.ok) throw new Error(waterResult.error.code);

    const roadCodes = new Uint8Array(CELL_COUNT);
    roadCodes[index(4, 4)] = BASIC_ROAD_CODE;
    roadCodes[index(5, 4)] = BASIC_ROAD_CODE;
    const roads = createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 3,
        definitionCodes: roadCodes,
      },
      WORLD_CONFIG,
    );

    const zoneCodes = new Uint8Array(CELL_COUNT);
    for (const z of [5, 6]) {
      for (const x of [4, 5]) zoneCodes[index(x, z)] = COMMERCIAL_ZONE_CODE;
    }
    const zones = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 5,
        definitionCodes: zoneCodes,
      },
      WORLD_CONFIG,
    );
    const buildings = createBuildingSnapshot(
      {
        revision: 6,
        instances: [
          {
            instanceId: 'building:6:1',
            buildingDefinitionId: 'commercial-office-2x2',
            buildingDefinitionVersion: 1,
            originCell: { x: 4, z: 5 },
            rotationQuarterTurns: 2,
          },
        ],
      },
      WORLD_CONFIG,
    );

    const proposedCodes = new Uint8Array(CELL_COUNT);
    const corePlan = Object.freeze({
      operation: 'bulldoze' as const,
      addedCells: Object.freeze([]),
      removedCells: Object.freeze([Object.freeze({ x: 4, z: 4 }), Object.freeze({ x: 5, z: 4 })]),
      proposedDefinitionCodes: proposedCodes,
      valid: true,
      invalidReason: null,
    });
    const candidate = Object.freeze({
      corePlan,
      previewPlan: corePlan,
      valid: true,
      invalidReason: null,
      blockedZoneCells: Object.freeze([]),
    }) as unknown as Parameters<typeof guardRoadPlanWithBuildings>[0];

    const guarded = guardRoadPlanWithBuildings(
      candidate,
      roads,
      buildings,
      terrain,
      waterResult.value,
      zones,
      WORLD_CONFIG,
    );

    expect(guarded).toMatchObject({
      valid: false,
      invalidReason: 'road:building-access-lost',
      blockedBuildingCells: [{ x: 4, z: 5 }],
    });
  });
});
