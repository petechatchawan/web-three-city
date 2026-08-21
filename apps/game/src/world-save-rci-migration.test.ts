import { createBuildingSnapshot } from '@web-three-city/building-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { createSimulationSnapshot, deriveMacroHourIndex } from '@web-three-city/simulation-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { decodeWorldSave, encodeWorldSaveV4, encodeWorldSaveV5 } from './world-save.js';

function createWorldFixture() {
  const terrain = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  if (!terrain.ok) throw new Error('fixture generation failed');
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
  const buildings = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
  const simulation = createSimulationSnapshot({
    revision: 4,
    absoluteGameMinute: 27 * 60,
    growthSequence: 3,
  });
  const rci = createInitialRciSnapshot({
    absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
  });
  return { terrain: terrain.value, roads, zones, buildings, simulation, rci };
}

describe('WorldSaveV5 RCI foundation', () => {
  it('round-trips RCI authority inside WorldSaveV5', () => {
    const fixture = createWorldFixture();
    const encoded = encodeWorldSaveV5(
      fixture.terrain,
      fixture.roads,
      fixture.zones,
      fixture.buildings,
      fixture.simulation,
      fixture.rci,
    );
    const decoded = decodeWorldSave(encoded, WORLD_CONFIG);

    expect(encoded.schemaVersion).toBe(5);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.rci).toEqual(fixture.rci);
      expect(Object.isFrozen(decoded.value.rci)).toBe(true);
    }
  });

  it('migrates WorldSaveV4 to an empty deterministic RCI snapshot', () => {
    const fixture = createWorldFixture();
    const decoded = decodeWorldSave(
      encodeWorldSaveV4(
        fixture.terrain,
        fixture.roads,
        fixture.zones,
        fixture.buildings,
        fixture.simulation,
      ),
      WORLD_CONFIG,
    );

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.rci).toEqual(
        createInitialRciSnapshot({
          absoluteTick: deriveMacroHourIndex(decoded.value.simulation.absoluteGameMinute),
        }),
      );
    }
  });

  it('fails closed for malformed RCI authority', () => {
    const fixture = createWorldFixture();
    const valid = encodeWorldSaveV5(
      fixture.terrain,
      fixture.roads,
      fixture.zones,
      fixture.buildings,
      fixture.simulation,
      fixture.rci,
    );
    const decoded = decodeWorldSave(
      {
        ...valid,
        rci: { kind: 'rci-save', schemaVersion: 2 },
      },
      WORLD_CONFIG,
    );

    expect(decoded).toEqual({
      ok: false,
      error: {
        code: 'world-save:invalid-rci',
        details: { rciCode: 'rci-save:invalid-schema' },
      },
    });
  });
});
