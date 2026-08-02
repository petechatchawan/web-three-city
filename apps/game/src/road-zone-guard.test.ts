import {
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  planRoadMutation,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  RESIDENTIAL_ZONE_CODE,
  createZoneSnapshot,
} from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { createRoadPlacementEnvironment } from './road-placement-environment.js';
import { guardRoadPlanWithZones } from './road-zone-guard.js';
import { type ZoneWorldOccupancy } from './zone-placement-environment.js';

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

function waterFor(snapshot = terrain()) {
  const result = deriveWaterSnapshot(snapshot, WORLD_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

function roadsAt(...cells: readonly CellCoord[]): RoadSnapshot {
  const codes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = 1;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 5,
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

const EMPTY_OCCUPANCY: ZoneWorldOccupancy = Object.freeze({
  revision: 1,
  isBlocked: () => false,
});

describe('Road Zone guard', () => {
  it('rejects Road Build over a committed Zone cell', () => {
    const sourceTerrain = terrain();
    const sourceWater = waterFor(sourceTerrain);
    const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    const cell = { x: 8, z: 8 };
    const plan = planRoadMutation(
      roads,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      createRoadPlacementEnvironment(sourceTerrain, sourceWater, WORLD_CONFIG),
      WORLD_CONFIG,
    );
    expect(plan.valid).toBe(true);

    const guarded = guardRoadPlanWithZones(
      plan,
      roads,
      zonesAt(cell),
      sourceTerrain,
      sourceWater,
      EMPTY_OCCUPANCY,
      WORLD_CONFIG,
    );

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe('road:zone-occupied');
    expect(guarded.blockedZoneCells).toEqual([cell]);
    expect(guarded.previewPlan.valid).toBe(false);
  });

  it('rejects Bulldoze that removes the sole Road-access ray', () => {
    const sourceTerrain = terrain();
    const sourceWater = waterFor(sourceTerrain);
    const road = { x: 8, z: 7 };
    const zone = { x: 8, z: 8 };
    const roads = roadsAt(road);
    const plan = planRoadMutation(
      roads,
      { operation: 'bulldoze', definitionId: 'basic-road', cells: [road] },
      createRoadPlacementEnvironment(sourceTerrain, sourceWater, WORLD_CONFIG),
      WORLD_CONFIG,
    );
    expect(plan.valid).toBe(true);

    const guarded = guardRoadPlanWithZones(
      plan,
      roads,
      zonesAt(zone),
      sourceTerrain,
      sourceWater,
      EMPTY_OCCUPANCY,
      WORLD_CONFIG,
    );

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe('road:zone-access-lost');
    expect(guarded.blockedZoneCells).toEqual([zone]);
  });

  it('allows Bulldoze when an alternate committed Road-access ray remains', () => {
    const sourceTerrain = terrain();
    const sourceWater = waterFor(sourceTerrain);
    const northRoad = { x: 8, z: 7 };
    const eastRoad = { x: 9, z: 8 };
    const zone = { x: 8, z: 8 };
    const roads = roadsAt(northRoad, eastRoad);
    const plan = planRoadMutation(
      roads,
      { operation: 'bulldoze', definitionId: 'basic-road', cells: [northRoad] },
      createRoadPlacementEnvironment(sourceTerrain, sourceWater, WORLD_CONFIG),
      WORLD_CONFIG,
    );
    expect(plan.valid).toBe(true);

    const guarded = guardRoadPlanWithZones(
      plan,
      roads,
      zonesAt(zone),
      sourceTerrain,
      sourceWater,
      EMPTY_OCCUPANCY,
      WORLD_CONFIG,
    );

    expect(guarded.valid).toBe(true);
    expect(guarded.invalidReason).toBeNull();
    expect(guarded.blockedZoneCells).toEqual([]);
    expect(guarded.previewPlan).toBe(plan);
  });

  it('preserves an invalid core Road plan without replacing its reason', () => {
    const sourceTerrain = terrain();
    const sourceWater = waterFor(sourceTerrain);
    const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    const invalid = planRoadMutation(
      roads,
      { operation: 'bulldoze', definitionId: 'basic-road', cells: [{ x: 8, z: 8 }] },
      createRoadPlacementEnvironment(sourceTerrain, sourceWater, WORLD_CONFIG),
      WORLD_CONFIG,
    );
    expect(invalid.valid).toBe(false);

    const guarded = guardRoadPlanWithZones(
      invalid,
      roads,
      zonesAt({ x: 8, z: 8 }),
      sourceTerrain,
      sourceWater,
      EMPTY_OCCUPANCY,
      WORLD_CONFIG,
    );
    expect(guarded.invalidReason).toBe(invalid.invalidReason);
    expect(guarded.previewPlan).toBe(invalid);
    expect(guarded.blockedZoneCells).toEqual([]);
  });
});
