import { createRoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap, encodeTerrainSaveV1 } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV1 } from './world-save.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;
const LATTICE_COUNT = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function terrain() {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_COUNT).fill(2),
    seed: 1_464_156_977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 4,
  });
}

function roads() {
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 3,
      definitionCodes: new Uint8Array(CELL_COUNT),
    },
    WORLD_CONFIG,
  );
}

describe('Building migration from legacy World saves', () => {
  it('migrates WorldSaveV1 to an empty Building snapshot and coherent environment', () => {
    const decoded = decodeWorldSave(encodeWorldSaveV1(terrain(), roads()), WORLD_CONFIG);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.buildings).toMatchObject({ revision: 0, instances: [] });
    expect(decoded.value.buildingEnvironment).toMatchObject({
      terrainRevision: 4,
      waterSourceTerrainRevision: 4,
      roadRevision: 3,
      zoneRevision: 0,
    });
  });

  it('migrates legacy TerrainSaveV1 to empty Roads, Zones, and Buildings', () => {
    const decoded = decodeWorldSave(encodeTerrainSaveV1(terrain()), WORLD_CONFIG);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.roads).toMatchObject({ revision: 0 });
    expect(decoded.value.zones).toMatchObject({ revision: 0 });
    expect(decoded.value.buildings).toMatchObject({ revision: 0, instances: [] });
    expect(decoded.value.buildingEnvironment).toMatchObject({
      terrainRevision: 4,
      waterSourceTerrainRevision: 4,
      roadRevision: 0,
      zoneRevision: 0,
    });
  });
});
