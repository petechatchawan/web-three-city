import { createBuildingSnapshot } from '@web-three-city/building-core';
import { createSimulationSnapshot } from '@web-three-city/simulation-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV4 } from './world-save.js';

describe('WorldSaveV4', () => {
  it('persists Simulation and Construction lifecycle authority', () => {
    const terrain = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
    if (!terrain.ok) throw new Error('fixture generation failed');
    const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    const buildings = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    const simulation = createSimulationSnapshot({ revision: 4, absoluteTick: 27, growthSequence: 3 });
    const decoded = decodeWorldSave(
      encodeWorldSaveV4(terrain.value, roads, zones, buildings, simulation),
      WORLD_CONFIG,
    );
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.simulation).toEqual({ revision: 0, absoluteTick: 27, growthSequence: 3 });
    }
  });

  it('fails closed for malformed Simulation authority', () => {
    const result = decodeWorldSave(
      {
        kind: 'world-save',
        schemaVersion: 4,
        terrain: {},
        roads: {},
        zones: {},
        buildings: {},
        simulation: { kind: 'simulation-save', schemaVersion: 1, absoluteTick: -1, growthSequence: 0 },
      },
      WORLD_CONFIG,
    );
    expect(result.ok).toBe(false);
  });
});
