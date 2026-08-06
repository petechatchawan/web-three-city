import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createRoadSnapshot } from '@web-three-city/road-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { createZoneSnapshot } from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV4, encodeWorldSaveV5 } from './world-save.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;
const LATTICE_COUNT = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function emptyWorld() {
  const terrain = createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_COUNT).fill(2),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 1,
  });
  const roads = createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
      definitionCodes: new Uint8Array(CELL_COUNT),
    },
    WORLD_CONFIG,
  );
  const zones = createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
      definitionCodes: new Uint8Array(CELL_COUNT),
    },
    WORLD_CONFIG,
  );
  const buildings = createEmptyBuildingSnapshot(WORLD_CONFIG);
  const simulation = createInitialSimulationSnapshot();
  return { terrain, roads, zones, buildings, simulation };
}

describe('WorldSaveV5 RCI integration', () => {
  it('round-trips the authoritative RCI snapshot with Simulation and Buildings', () => {
    const world = emptyWorld();
    const initial = createInitialRciSnapshot({
      absoluteTick: world.simulation.absoluteTick,
      deterministicSeed: 73,
    });
    const rci = {
      ...initial,
      demand: {
        revision: 2,
        demand: {
          residentialMilli: 20_000,
          commercialMilli: -5_000,
          industrialMilli: 10_000,
          evaluatedAtTick: world.simulation.absoluteTick,
        },
        growthGates: {
          residentialOpen: true,
          commercialOpen: false,
          industrialOpen: true,
          evaluatedAtTick: world.simulation.absoluteTick,
        },
      },
    };
    const decoded = decodeWorldSave(
      encodeWorldSaveV5(
        world.terrain,
        world.roads,
        world.zones,
        world.buildings,
        world.simulation,
        rci,
      ),
      WORLD_CONFIG,
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.simulation).toEqual(world.simulation);
    expect(decoded.value.buildings).toEqual(world.buildings);
    expect(decoded.value.rci).toEqual(rci);
  });

  it('migrates WorldSaveV4 to deterministic empty RCI authority', () => {
    const world = emptyWorld();
    const decoded = decodeWorldSave(
      encodeWorldSaveV4(world.terrain, world.roads, world.zones, world.buildings, world.simulation),
      WORLD_CONFIG,
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.rci.population.citizens).toEqual([]);
    expect(decoded.value.rci.housing.assignments).toEqual([]);
    expect(decoded.value.rci.employment.assignments).toEqual([]);
    expect(decoded.value.rci.demand.demand.evaluatedAtTick).toBe(world.simulation.absoluteTick);
  });

  it('rejects malformed RCI payload without exposing partial world state', () => {
    const world = emptyWorld();
    const encoded = encodeWorldSaveV5(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      world.simulation,
      createInitialRciSnapshot({ absoluteTick: world.simulation.absoluteTick }),
    );
    const decoded = decodeWorldSave(
      { ...encoded, rci: { ...encoded.rci, schemaVersion: 99 } },
      WORLD_CONFIG,
    );
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error.code).toBe('world-save:invalid-rci');
    expect('value' in decoded).toBe(false);
  });
});
