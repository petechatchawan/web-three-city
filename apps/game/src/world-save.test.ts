import { createRoadSnapshot, roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import {
  createTerrainMap,
  encodeTerrainSaveV1,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { WORLD_CONFIG, vertexIndex } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV1 } from './world-save.js';

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

describe('WorldSaveV1', () => {
  it('round-trips Terrain and valid Roads as one coherent staged world', () => {
    const sourceTerrain = terrain();
    const sourceRoads = roads([{ x: 4, z: 4 }]);
    const decoded = decodeWorldSave(encodeWorldSaveV1(sourceTerrain, sourceRoads), WORLD_CONFIG);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.terrain.revision).toBe(4);
    expect(decoded.value.water.sourceTerrainRevision).toBe(4);
    expect(decoded.value.roads.revision).toBe(3);
    expect(roadOccupiedAt(decoded.value.roads, { x: 4, z: 4 })).toBe(true);
    expect(decoded.value.roadEnvironment.terrainRevision).toBe(4);
    expect(Object.isFrozen(decoded.value)).toBe(true);
  });

  it('migrates legacy TerrainSaveV1 to empty Roads at revision zero', () => {
    const decoded = decodeWorldSave(encodeTerrainSaveV1(terrain()), WORLD_CONFIG);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.roads.revision).toBe(0);
    expect(decoded.value.roads.definitionCodes.every((code) => code === 0)).toBe(true);
  });

  it('rejects a Road on wet Terrain without exposing partial state', () => {
    const wetTerrain = terrain(0);
    const southCell = { x: 4, z: WORLD_CONFIG.mapHeight - 1 };
    const decoded = decodeWorldSave(
      encodeWorldSaveV1(wetTerrain, roads([southCell])),
      WORLD_CONFIG,
    );

    expect(decoded).toEqual({
      ok: false,
      error: { code: 'world-save:invalid-road-placement', details: { reason: 'road:wet-cell' } },
    });
    expect('value' in decoded).toBe(false);
  });

  it('rejects a Road on unsupported Terrain without exposing partial state', () => {
    const unsupported = terrain();
    const levels = unsupported.heightLevels;
    const cell = { x: 4, z: 4 };
    levels[vertexIndex(cell, WORLD_CONFIG)] = 3;
    levels[vertexIndex({ x: 5, z: 4 }, WORLD_CONFIG)] = 2;
    levels[vertexIndex({ x: 4, z: 5 }, WORLD_CONFIG)] = 2;
    levels[vertexIndex({ x: 5, z: 5 }, WORLD_CONFIG)] = 3;
    const shapedTerrain = createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: levels,
      seed: unsupported.seed,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: unsupported.revision,
    });
    const decoded = decodeWorldSave(encodeWorldSaveV1(shapedTerrain, roads([cell])), WORLD_CONFIG);

    expect(decoded).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-road-placement',
        details: { reason: 'road:unsupported-terrain' },
      },
    });
    expect('value' in decoded).toBe(false);
  });
});
