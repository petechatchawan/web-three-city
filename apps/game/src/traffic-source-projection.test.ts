import {
  ARTERIAL_ROAD_CODE,
  BASIC_ROAD_CODE,
  COLLECTOR_ROAD_CODE,
  ROAD_EAST,
  ROAD_WEST,
  createRoadSnapshot,
} from '@web-three-city/road-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createRoadTrafficSourceProjectionFromEnvironment } from './traffic-source-projection.js';

function indexOf(x: number, z: number): number {
  return z * WORLD_CONFIG.mapWidth + x;
}

describe('Game Traffic Road source projection', () => {
  it('connects occupied Local, Collector, and Arterial Road cells across Road types', () => {
    const definitionCodes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
    definitionCodes[indexOf(1, 1)] = BASIC_ROAD_CODE;
    definitionCodes[indexOf(2, 1)] = COLLECTOR_ROAD_CODE;
    definitionCodes[indexOf(3, 1)] = ARTERIAL_ROAD_CODE;
    const roads = createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 7,
        definitionCodes,
      },
      WORLD_CONFIG,
    );
    const flatEnvironment = {
      surfaceAt: () => ({ minimumLevel: 0, maximumLevel: 0 }),
    } as unknown as Parameters<typeof createRoadTrafficSourceProjectionFromEnvironment>[1];

    const projection = createRoadTrafficSourceProjectionFromEnvironment(roads, flatEnvironment);
    const cells = projection.cells.filter((cell) => cell.z === 1 && cell.x >= 1 && cell.x <= 3);

    expect(
      cells.map((cell) => ({
        definitionCode: cell.definitionCode,
        connectionMask: cell.connectionMask,
      })),
    ).toEqual([
      { definitionCode: BASIC_ROAD_CODE, connectionMask: ROAD_EAST },
      {
        definitionCode: COLLECTOR_ROAD_CODE,
        connectionMask: ROAD_EAST | ROAD_WEST,
      },
      { definitionCode: ARTERIAL_ROAD_CODE, connectionMask: ROAD_WEST },
    ]);
  });
});
