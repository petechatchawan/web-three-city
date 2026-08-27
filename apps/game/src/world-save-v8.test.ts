import { absoluteGameMinute, createSimulationSnapshot } from '@web-three-city/simulation-core';
import { absoluteTransportSecond, createTrafficSnapshotV2 } from '@web-three-city/traffic-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import * as worldSave from './world-save.js';

type WorldSaveV8Api = Readonly<{
  encodeWorldSaveV8?: (...args: Parameters<typeof worldSave.encodeWorldSaveV7>) => unknown;
}>;

const api = worldSave as WorldSaveV8Api;

describe('WorldSaveV8', () => {
  it('migrates a V7 hour-eight checkpoint to minute 480 without changing the V7 payload', () => {
    expect(typeof api.encodeWorldSaveV8).toBe('function');
    const world = createApplicationFixture({ withCommercialBuilding: true });
    const simulation = createSimulationSnapshot({
      revision: 8,
      absoluteGameMinute: 480,
      growthSequence: world.simulation.growthSequence,
    });
    const v7 = worldSave.encodeWorldSaveV7(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      simulation,
      world.rci,
      world.economy,
      world.mobility,
      world.traffic,
    );
    const sourceBytes = JSON.stringify(v7);

    const decoded = worldSave.decodeWorldSave(v7, WORLD_CONFIG);

    expect(decoded).toMatchObject({ ok: true });
    if (!decoded.ok) return;
    expect(decoded.value.simulation.absoluteGameMinute).toBe(480);
    expect((decoded.value.traffic as { schemaVersion: number }).schemaVersion).toBe(2);
    expect(JSON.stringify(v7)).toBe(sourceBytes);
  });

  it('preserves the exact completed transport quantum on a V8 checkpoint', () => {
    const world = createApplicationFixture({ withCommercialBuilding: true });
    const traffic = createTrafficSnapshotV2({
      schemaVersion: 2,
      revision: 4,
      policyVersion: 1,
      graphSourceRoadRevision: world.roads.revision,
      graphSourceBuildingRevision: world.buildings.revision,
      timeCursor: {
        sourceGameMinute: absoluteGameMinute(480),
        completedTransportQuantaWithinMinute: 2,
        absoluteTransportSecond: absoluteTransportSecond(1922),
        temporalPolicyVersion: 1,
      },
      activeTrips: [],
    });
    const encoded = api.encodeWorldSaveV8!(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      createSimulationSnapshot({ revision: 8, absoluteGameMinute: 480, growthSequence: 0 }),
      world.rci,
      world.economy,
      world.mobility,
      traffic as never,
    );

    const decoded = worldSave.decodeWorldSave(encoded, WORLD_CONFIG);
    expect(decoded).toMatchObject({ ok: true });
    if (!decoded.ok) return;
    expect((decoded.value.traffic as unknown as { timeCursor: unknown }).timeCursor).toEqual({
      sourceGameMinute: 480,
      completedTransportQuantaWithinMinute: 2,
      absoluteTransportSecond: 1922,
      temporalPolicyVersion: 1,
    });
  });
});
