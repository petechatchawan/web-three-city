import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
} from '@web-three-city/road-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  createZonePlacementEnvironment,
  type ZoneWorldOccupancy,
} from './zone-placement-environment.js';

const LATTICE_LENGTH = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function terrain(revision = 4) {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_LENGTH).fill(2),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  });
}

function waterFor(snapshot = terrain()) {
  const result = deriveWaterSnapshot(snapshot, WORLD_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

function roadsAt(...cells: readonly CellCoord[]) {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 7,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function occupancy(
  revision = 11,
  blocked: readonly CellCoord[] = [],
): ZoneWorldOccupancy {
  const keys = new Set(blocked.map((cell) => `${cell.x}:${cell.z}`));
  return Object.freeze({
    revision,
    isBlocked(cell: CellCoord) {
      return keys.has(`${cell.x}:${cell.z}`);
    },
  });
}

describe('Zone placement environment', () => {
  it('captures coherent immutable Terrain, Water, Road, and occupancy revisions', () => {
    const sourceTerrain = terrain();
    const sourceWater = waterFor(sourceTerrain);
    const sourceRoads = roadsAt({ x: 8, z: 7 });
    const sourceOccupancy = occupancy(11, [{ x: 8, z: 6 }]);
    const environment = createZonePlacementEnvironment(
      sourceTerrain,
      sourceWater,
      sourceRoads,
      sourceOccupancy,
      WORLD_CONFIG,
    );

    expect(environment).toMatchObject({
      terrainRevision: 4,
      waterSourceTerrainRevision: 4,
      roadRevision: 7,
      occupancyRevision: 11,
    });
    expect(environment.isDry({ x: 8, z: 8 })).toBe(true);
    expect(environment.isRoadOccupied({ x: 8, z: 7 })).toBe(true);
    expect(environment.isBlockedByNonZoneOccupancy({ x: 8, z: 6 })).toBe(true);
    expect(environment.roadAccessAt({ x: 8, z: 8 })).toEqual({
      direction: 'north',
      distance: 1,
      roadCell: { x: 8, z: 7 },
    });

    sourceRoads.definitionCodes[7 * WORLD_CONFIG.mapWidth + 8] = 0;
    expect(environment.isRoadOccupied({ x: 8, z: 7 })).toBe(true);
    expect(Object.isFrozen(environment)).toBe(true);
  });

  it('supports an empty Road and occupancy view', () => {
    const sourceTerrain = terrain();
    const environment = createZonePlacementEnvironment(
      sourceTerrain,
      waterFor(sourceTerrain),
      createEmptyRoadSnapshot(WORLD_CONFIG),
      occupancy(),
      WORLD_CONFIG,
    );
    expect(environment.roadAccessAt({ x: 8, z: 8 })).toBeNull();
    expect(environment.isBlockedByNonZoneOccupancy({ x: 8, z: 8 })).toBe(false);
  });

  it('rejects incoherent revisions and malformed occupancy', () => {
    const first = terrain(4);
    const second = terrain(5);
    expect(() =>
      createZonePlacementEnvironment(
        second,
        waterFor(first),
        createEmptyRoadSnapshot(WORLD_CONFIG),
        occupancy(),
        WORLD_CONFIG,
      ),
    ).toThrow('zone-environment:incoherent-revision');

    expect(() =>
      createZonePlacementEnvironment(
        first,
        waterFor(first),
        createEmptyRoadSnapshot(WORLD_CONFIG),
        occupancy(-1),
        WORLD_CONFIG,
      ),
    ).toThrow('zone-environment:invalid-occupancy');
  });
});
