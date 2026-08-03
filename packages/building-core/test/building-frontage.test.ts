import { describe, expect, it } from 'vitest';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import {
  resolveBuildingFrontage,
  type BuildingDevelopmentEnvironment,
  type BuildingInstance,
} from '../src/index.js';

const FLAT = Object.freeze({
  cell: Object.freeze({ x: 0, z: 0 }),
  corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
  shape: 'flat',
  minimumLevel: 2,
  maximumLevel: 2,
  slopeAxis: null,
}) as TerrainCellSurfaceProfile;
const INSTANCE: BuildingInstance = Object.freeze({
  instanceId: 'building:1:1',
  buildingDefinitionId: 'commercial-office-2x2',
  buildingDefinitionVersion: 1,
  originCell: Object.freeze({ x: 2, z: 2 }),
  rotationQuarterTurns: 0,
});

function environment(): BuildingDevelopmentEnvironment {
  return Object.freeze({
    terrainRevision: 1,
    waterSourceTerrainRevision: 1,
    roadRevision: 1,
    zoneRevision: 1,
    surfaceAt: () => FLAT,
    isDry: () => true,
    isRoadOccupied: () => false,
    zoneDefinitionIdAt: () => 'commercial',
    roadAccessAt(cell) {
      if (cell.x === 2 && cell.z === 2) {
        return Object.freeze({ direction: 'east', distance: 1, roadCell: Object.freeze({ x: 4, z: 2 }) });
      }
      if (cell.x === 3 && cell.z === 2) {
        return Object.freeze({ direction: 'north', distance: 1, roadCell: Object.freeze({ x: 3, z: 1 }) });
      }
      return null;
    },
  });
}

describe('building frontage', () => {
  it('uses distance then north/east/south/west and cell order', () => {
    expect(resolveBuildingFrontage(INSTANCE, environment())).toEqual({
      direction: 'north',
      distance: 1,
      frontageCell: { x: 3, z: 2 },
      roadCell: { x: 3, z: 1 },
    });
  });
});
