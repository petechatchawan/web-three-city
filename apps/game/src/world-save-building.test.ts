import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { decodeWorldSave, encodeWorldSaveV2, encodeWorldSaveV3 } from './world-save.js';

describe('WorldSaveV3 buildings', () => {
  it('migrates WorldSaveV2 to empty Buildings', () => {
    const terrain = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!terrain.ok) throw new Error(terrain.error.code);
    const decoded = decodeWorldSave(encodeWorldSaveV2(terrain.value, createEmptyRoadSnapshot(WORLD_CONFIG), createEmptyZoneSnapshot(WORLD_CONFIG)), WORLD_CONFIG);
    expect(decoded.ok && decoded.value.buildings.instances).toHaveLength(0);
  });

  it('persists authoritative Building state in WorldSaveV3', () => {
    const terrain = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!terrain.ok) throw new Error(terrain.error.code);
    const buildings = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    expect(encodeWorldSaveV3(terrain.value, createEmptyRoadSnapshot(WORLD_CONFIG), createEmptyZoneSnapshot(WORLD_CONFIG), buildings)).toMatchObject({ schemaVersion: 3, buildings: { schemaVersion: 1 } });
  });
});
