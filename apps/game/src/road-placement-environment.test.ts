import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG, vertexIndex } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createRoadPlacementEnvironment } from './road-placement-environment.js';

function terrainWithLevel(level: number, revision = 2) {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
      level,
    ),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  });
}

describe('road placement environment', () => {
  it('exposes coherent immutable Terrain and Water queries', () => {
    const terrain = terrainWithLevel(2);
    const waterResult = deriveWaterSnapshot(terrain, WORLD_CONFIG);
    expect(waterResult.ok).toBe(true);
    if (!waterResult.ok) return;

    const environment = createRoadPlacementEnvironment(terrain, waterResult.value, WORLD_CONFIG);

    expect(environment.terrainRevision).toBe(2);
    expect(environment.waterSourceTerrainRevision).toBe(2);
    expect(environment.isDry({ x: 4, z: 4 })).toBe(true);
    expect(environment.surfaceAt({ x: 4, z: 4 })).toMatchObject({ shape: 'flat' });
    expect(Object.isFrozen(environment)).toBe(true);
  });

  it('reports a sea-connected cell as wet', () => {
    const terrain = terrainWithLevel(0);
    const waterResult = deriveWaterSnapshot(terrain, WORLD_CONFIG);
    expect(waterResult.ok).toBe(true);
    if (!waterResult.ok) return;

    const environment = createRoadPlacementEnvironment(terrain, waterResult.value, WORLD_CONFIG);
    expect(environment.isDry({ x: 4, z: WORLD_CONFIG.mapHeight - 1 })).toBe(false);
  });

  it('defensively captures supplied snapshots and rejects incoherent revisions', () => {
    const terrainRevision2 = terrainWithLevel(2, 2);
    const terrainRevision1 = terrainWithLevel(2, 1);
    const waterResult = deriveWaterSnapshot(terrainRevision1, WORLD_CONFIG);
    expect(waterResult.ok).toBe(true);
    if (!waterResult.ok) return;

    expect(() =>
      createRoadPlacementEnvironment(terrainRevision2, waterResult.value, WORLD_CONFIG),
    ).toThrow('road-environment:incoherent-revision');

    const coherentWater = deriveWaterSnapshot(terrainRevision2, WORLD_CONFIG);
    expect(coherentWater.ok).toBe(true);
    if (!coherentWater.ok) return;
    const environment = createRoadPlacementEnvironment(
      terrainRevision2,
      coherentWater.value,
      WORLD_CONFIG,
    );
    const exposed = terrainRevision2.heightLevels;
    exposed[vertexIndex({ x: 4, z: 4 }, WORLD_CONFIG)] = 0;
    expect(environment.surfaceAt({ x: 4, z: 4 })).toMatchObject({
      shape: 'flat',
      minimumLevel: 2,
    });
  });
});
