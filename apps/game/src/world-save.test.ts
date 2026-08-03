import { createRoadSnapshot, roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import {
  createTerrainMap,
  encodeTerrainSaveV1,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import {
  RESIDENTIAL_ZONE_CODE,
  createZoneSnapshot,
  zoneDefinitionCodeAt,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { WORLD_CONFIG, vertexIndex } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV1, encodeWorldSaveV2 } from './world-save.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;
const LATTICE_COUNT = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function terrain(level = 2, revision = 4): TerrainSnapshot {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_COUNT).fill(level),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  });
}

function roads(cells: readonly { readonly x: number; readonly z: number }[]): RoadSnapshot {
  const definitionCodes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) definitionCodes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = 1;
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

function zones(cells: readonly { readonly x: number; readonly z: number }[]): ZoneSnapshot {
  const definitionCodes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) {
    definitionCodes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = RESIDENTIAL_ZONE_CODE;
  }
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

describe('WorldSave', () => {
  it('round-trips Terrain, Roads, and Zones as one coherent WorldSaveV2', () => {
    const sourceTerrain = terrain();
    const sourceRoads = roads([{ x: 4, z: 4 }]);
    const sourceZones = zones([{ x: 4, z: 5 }]);
    const decoded = decodeWorldSave(
      encodeWorldSaveV2(sourceTerrain, sourceRoads, sourceZones),
      WORLD_CONFIG,
    );

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.terrain.revision).toBe(4);
    expect(decoded.value.water.sourceTerrainRevision).toBe(4);
    expect(decoded.value.roads.revision).toBe(3);
    expect(decoded.value.zones.revision).toBe(5);
    expect(roadOccupiedAt(decoded.value.roads, { x: 4, z: 4 })).toBe(true);
    expect(zoneDefinitionCodeAt(decoded.value.zones, { x: 4, z: 5 })).toBe(RESIDENTIAL_ZONE_CODE);
    expect(decoded.value.roadEnvironment.terrainRevision).toBe(4);
    expect(decoded.value.zoneEnvironment.roadRevision).toBe(3);
    expect(Object.isFrozen(decoded.value)).toBe(true);
  });

  it('migrates WorldSaveV1 to preserved Roads and empty Zones', () => {
    const decoded = decodeWorldSave(
      encodeWorldSaveV1(terrain(), roads([{ x: 4, z: 4 }])),
      WORLD_CONFIG,
    );

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(roadOccupiedAt(decoded.value.roads, { x: 4, z: 4 })).toBe(true);
    expect(decoded.value.zones.revision).toBe(0);
    expect(decoded.value.zones.definitionCodes.every((code) => code === 0)).toBe(true);
  });

  it('migrates legacy TerrainSaveV1 to empty Roads and Zones at revision zero', () => {
    const decoded = decodeWorldSave(encodeTerrainSaveV1(terrain()), WORLD_CONFIG);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.roads.revision).toBe(0);
    expect(decoded.value.roads.definitionCodes.every((code) => code === 0)).toBe(true);
    expect(decoded.value.zones.revision).toBe(0);
    expect(decoded.value.zones.definitionCodes.every((code) => code === 0)).toBe(true);
  });

  it('rejects malformed Zone bytes without exposing partial state', () => {
    const encoded = encodeWorldSaveV2(terrain(), roads([{ x: 4, z: 4 }]), zones([{ x: 4, z: 5 }]));
    const decoded = decodeWorldSave(
      { ...encoded, zones: { ...encoded.zones, definitionCodes: 'not-base64' } },
      WORLD_CONFIG,
    );

    expect(decoded).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-zones',
        details: { zoneCode: 'zone-save:invalid-base64' },
      },
    });
    expect('value' in decoded).toBe(false);
  });

  it('rejects a Zone overlapping a Road without exposing partial state', () => {
    const cell = { x: 4, z: 4 };
    const decoded = decodeWorldSave(
      encodeWorldSaveV2(terrain(), roads([cell]), zones([cell])),
      WORLD_CONFIG,
    );

    expect(decoded).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-zone-placement',
        details: { reason: 'zone:road-occupied', cell },
      },
    });
    expect('value' in decoded).toBe(false);
  });

  it('rejects wet, non-flat, and Road-inaccessible Zones atomically', () => {
    const inaccessibleCell = { x: 20, z: 20 };
    const inaccessible = decodeWorldSave(
      encodeWorldSaveV2(terrain(), roads([{ x: 4, z: 4 }]), zones([inaccessibleCell])),
      WORLD_CONFIG,
    );
    expect(inaccessible).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-zone-placement',
        details: { reason: 'zone:road-access-required', cell: inaccessibleCell },
      },
    });

    const wetCell = { x: 4, z: WORLD_CONFIG.mapHeight - 1 };
    const wet = decodeWorldSave(
      encodeWorldSaveV2(terrain(0), roads([]), zones([wetCell])),
      WORLD_CONFIG,
    );
    expect(wet).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-zone-placement',
        details: { reason: 'zone:wet-cell', cell: wetCell },
      },
    });

    const shaped = terrain();
    const levels = shaped.heightLevels;
    const nonFlatCell = { x: 4, z: 5 };
    levels[vertexIndex({ x: nonFlatCell.x, z: nonFlatCell.z + 1 }, WORLD_CONFIG)] = 3;
    const nonFlatTerrain = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: levels,
      seed: shaped.seed,
      generatorVersion: shaped.generatorVersion,
      generationAttempt: shaped.generationAttempt,
      revision: shaped.revision,
    });
    const nonFlat = decodeWorldSave(
      encodeWorldSaveV2(nonFlatTerrain, roads([{ x: 4, z: 4 }]), zones([nonFlatCell])),
      WORLD_CONFIG,
    );
    expect(nonFlat).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-zone-placement',
        details: { reason: 'zone:unsupported-terrain', cell: nonFlatCell },
      },
    });
  });

  it('continues rejecting invalid Road placement before Zone decoding', () => {
    const wetTerrain = terrain(0);
    const southCell = { x: 4, z: WORLD_CONFIG.mapHeight - 1 };
    const decoded = decodeWorldSave(
      encodeWorldSaveV2(wetTerrain, roads([southCell]), zones([])),
      WORLD_CONFIG,
    );

    expect(decoded).toEqual({
      ok: false,
      error: { code: 'world-save:invalid-road-placement', details: { reason: 'road:wet-cell' } },
    });
    expect('value' in decoded).toBe(false);
  });
});
