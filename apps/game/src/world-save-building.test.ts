import {
  createBuildingSnapshot,
  type BuildingInstance,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import {
  COMMERCIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  createZoneSnapshot,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV2, encodeWorldSaveV3 } from './world-save.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;
const LATTICE_COUNT = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);
const ROAD_CELLS = Object.freeze([Object.freeze({ x: 4, z: 4 }), Object.freeze({ x: 5, z: 4 })]);
const BUILDING_CELLS = Object.freeze([
  Object.freeze({ x: 4, z: 5 }),
  Object.freeze({ x: 5, z: 5 }),
  Object.freeze({ x: 4, z: 6 }),
  Object.freeze({ x: 5, z: 6 }),
]);

function terrain(): TerrainSnapshot {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_COUNT).fill(2),
    seed: 1_464_156_977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 4,
  });
}

function roads(): RoadSnapshot {
  const definitionCodes = new Uint8Array(CELL_COUNT);
  for (const cell of ROAD_CELLS) {
    definitionCodes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = 1;
  }
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 3,
      definitionCodes,
    },
    WORLD_CONFIG,
  );
}

function zones(
  codeAt: (cell: (typeof BUILDING_CELLS)[number], index: number) => number = () =>
    COMMERCIAL_ZONE_CODE,
): ZoneSnapshot {
  const definitionCodes = new Uint8Array(CELL_COUNT);
  BUILDING_CELLS.forEach((cell, index) => {
    definitionCodes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = codeAt(cell, index);
  });
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 5,
      definitionCodes,
    },
    WORLD_CONFIG,
  );
}

function office(overrides: Partial<BuildingInstance> = {}): BuildingInstance {
  return Object.freeze({
    instanceId: 'building:6:1',
    buildingDefinitionId: 'commercial-office-2x2',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 4, z: 5 }),
    rotationQuarterTurns: 0,
    ...overrides,
  });
}

function buildings(instances: readonly BuildingInstance[] = [office()]): BuildingSnapshot {
  return createBuildingSnapshot({ revision: 6, instances }, WORLD_CONFIG);
}

describe('WorldSaveV3 buildings', () => {
  it('migrates WorldSaveV2 to an authoritative empty Building snapshot', () => {
    const decoded = decodeWorldSave(encodeWorldSaveV2(terrain(), roads(), zones()), WORLD_CONFIG);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.buildings).toMatchObject({ revision: 0, instances: [] });
    expect(decoded.value.buildingEnvironment).toMatchObject({
      terrainRevision: 4,
      waterSourceTerrainRevision: 4,
      roadRevision: 3,
      zoneRevision: 5,
    });
  });

  it('round-trips only authoritative Building instance fields in WorldSaveV3', () => {
    const encoded = encodeWorldSaveV3(terrain(), roads(), zones(), buildings());
    expect(encoded.buildings.instances).toEqual([
      {
        instanceId: 'building:6:1',
        buildingDefinitionId: 'commercial-office-2x2',
        buildingDefinitionVersion: 1,
        originCell: { x: 4, z: 5 },
        rotationQuarterTurns: 0,
      },
    ]);
    expect(encoded.buildings.instances[0]).not.toHaveProperty('occupiedCells');
    expect(encoded.buildings.instances[0]).not.toHaveProperty('roadFrontage');

    const decoded = decodeWorldSave(encoded, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.buildings).toEqual(buildings());
  });

  it('rejects unknown Building content before exposing partial World state', () => {
    const encoded = encodeWorldSaveV3(terrain(), roads(), zones(), buildings());
    const decoded = decodeWorldSave(
      {
        ...encoded,
        buildings: {
          ...encoded.buildings,
          instances: [
            {
              ...encoded.buildings.instances[0],
              buildingDefinitionId: 'missing-building-definition',
            },
          ],
        },
      },
      WORLD_CONFIG,
    );

    expect(decoded).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-buildings',
        details: { buildingCode: 'building-save:unknown-definition' },
      },
    });
    expect('value' in decoded).toBe(false);
  });

  it('rejects overlapping and out-of-bounds Building footprints during decoding', () => {
    const encoded = encodeWorldSaveV3(terrain(), roads(), zones(), buildings());
    const overlap = decodeWorldSave(
      {
        ...encoded,
        buildings: {
          ...encoded.buildings,
          instances: [
            ...encoded.buildings.instances,
            {
              instanceId: 'building:6:2',
              buildingDefinitionId: 'residential-cottage-1x1',
              buildingDefinitionVersion: 1,
              originCell: { x: 4, z: 5 },
              rotationQuarterTurns: 0,
            },
          ],
        },
      },
      WORLD_CONFIG,
    );
    expect(overlap).toMatchObject({
      ok: false,
      error: {
        code: 'world-save:invalid-buildings',
        details: { buildingCode: 'building-save:invalid-snapshot' },
      },
    });

    const outOfBounds = decodeWorldSave(
      {
        ...encoded,
        buildings: {
          ...encoded.buildings,
          instances: [
            {
              ...encoded.buildings.instances[0],
              originCell: {
                x: WORLD_CONFIG.mapWidth - 1,
                z: WORLD_CONFIG.mapHeight - 1,
              },
            },
          ],
        },
      },
      WORLD_CONFIG,
    );
    expect(outOfBounds).toMatchObject({
      ok: false,
      error: {
        code: 'world-save:invalid-buildings',
        details: { buildingCode: 'building-save:invalid-snapshot' },
      },
    });
  });

  it('rejects homogeneous incompatible and mixed-Zone Building footprints', () => {
    const incompatible = decodeWorldSave(
      encodeWorldSaveV3(
        terrain(),
        roads(),
        zones(() => RESIDENTIAL_ZONE_CODE),
        buildings(),
      ),
      WORLD_CONFIG,
    );
    expect(incompatible).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-building-placement',
        details: { instanceId: 'building:6:1' },
      },
    });

    const mixed = decodeWorldSave(
      encodeWorldSaveV3(
        terrain(),
        roads(),
        zones((_cell, index) =>
          index === BUILDING_CELLS.length - 1 ? RESIDENTIAL_ZONE_CODE : COMMERCIAL_ZONE_CODE,
        ),
        buildings(),
      ),
      WORLD_CONFIG,
    );
    expect(mixed).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-building-placement',
        details: { instanceId: 'building:6:1' },
      },
    });
  });
});
