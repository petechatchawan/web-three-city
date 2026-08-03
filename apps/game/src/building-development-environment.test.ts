import { describe, expect, it } from 'vitest';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';

describe('building development environment', () => {
  it('captures coherent source revisions and fail-closed accessors', () => {
    const generated = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!generated.ok) throw new Error(generated.error.code);
    const water = deriveWaterSnapshot(generated.value, WORLD_CONFIG);
    if (!water.ok) throw new Error(water.error.code);
    const environment = createBuildingDevelopmentEnvironment(
      generated.value,
      water.value,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      createEmptyZoneSnapshot(WORLD_CONFIG),
      WORLD_CONFIG,
    );
    expect(environment.terrainRevision).toBe(generated.value.revision);
    expect(environment.waterSourceTerrainRevision).toBe(generated.value.revision);
    expect(environment.zoneDefinitionIdAt({ x: 0, z: 0 })).toBeNull();
  });
});
