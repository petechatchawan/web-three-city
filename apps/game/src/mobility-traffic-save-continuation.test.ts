import { fingerprintMobilitySnapshot } from '@web-three-city/citizen-mobility-core';
import { createSimulationSnapshot } from '@web-three-city/simulation-core';
import { fingerprintTrafficSnapshot } from '@web-three-city/traffic-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import { planMobilityTrafficTick } from './mobility-traffic-tick.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';
import { decodeWorldSave, encodeWorldSaveV8 } from './world-save.js';

function simulationAt(
  base: ReturnType<typeof createTrafficReleaseFixture>['world']['simulation'],
  absoluteTick: number,
) {
  return createSimulationSnapshot({
    revision: base.revision + Math.max(1, absoluteTick - base.absoluteGameMinute),
    absoluteGameMinute: absoluteTick,
    growthSequence: base.growthSequence,
  });
}

function progress(
  fixture: ReturnType<typeof createTrafficReleaseFixture>,
  mobility: ReturnType<typeof createTrafficReleaseFixture>['world']['mobility'],
  traffic: ReturnType<typeof createTrafficReleaseFixture>['world']['traffic'],
  beforeTick: number,
  afterTick: number,
) {
  const world = fixture.world;
  let currentMobility = mobility;
  let currentTraffic = traffic;
  let previousMinute = beforeTick;
  const checkpoints =
    beforeTick === fixture.summary.startAbsoluteGameMinute
      ? [beforeTick + 1, afterTick]
      : [afterTick];
  for (const nextMinute of checkpoints) {
    if (nextMinute <= previousMinute) continue;
    const result = planMobilityTrafficTick({
      mobilityBefore: currentMobility,
      trafficBefore: currentTraffic,
      citizensAfter: createPresentCitizenMobilityProjection(world.rci, world.buildings, nextMinute),
      simulationBefore: simulationAt(world.simulation, previousMinute),
      simulationAfter: simulationAt(world.simulation, nextMinute),
      trafficSource: {
        roads: createRoadTrafficSourceProjectionFromEnvironment(
          world.roads,
          world.environments.building,
        ),
        buildingAccess: createBuildingTrafficAccessProjection(
          world.buildings,
          world.roads,
          world.environments.building,
        ),
      },
    });
    currentMobility = result.mobility;
    currentTraffic = result.traffic;
    previousMinute = nextMinute;
  }
  return { mobility: currentMobility, traffic: currentTraffic };
}

describe('Mobility/Traffic WorldSaveV8 continuation', () => {
  it('matches continuous morning+return commute after a midday save/decode boundary', () => {
    const fixture = createTrafficReleaseFixture();
    const continuous = progress(
      fixture,
      fixture.world.mobility,
      fixture.world.traffic,
      fixture.summary.startAbsoluteGameMinute,
      19 * 60,
    );

    const beforeSave = progress(
      fixture,
      fixture.world.mobility,
      fixture.world.traffic,
      fixture.summary.startAbsoluteGameMinute,
      12 * 60,
    );
    const middaySimulation = simulationAt(fixture.world.simulation, 12 * 60);
    const encoded = encodeWorldSaveV8(
      fixture.world.terrain,
      fixture.world.roads,
      fixture.world.zones,
      fixture.world.buildings,
      middaySimulation,
      fixture.world.rci,
      fixture.world.economy,
      beforeSave.mobility,
      beforeSave.traffic,
    );
    const decoded = decodeWorldSave(encoded, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    const resumed = progress(
      fixture,
      decoded.value.mobility,
      decoded.value.traffic,
      12 * 60,
      19 * 60,
    );

    expect(fingerprintMobilitySnapshot(resumed.mobility)).toBe(
      fingerprintMobilitySnapshot(continuous.mobility),
    );
    expect(fingerprintTrafficSnapshot(resumed.traffic)).toBe(
      fingerprintTrafficSnapshot(continuous.traffic),
    );
    expect(resumed.mobility.citizenStates.every((state) => state.currentActivity === 'Home')).toBe(
      true,
    );
    expect(resumed.mobility.trips).toHaveLength(fixture.summary.citizenIds.length * 2);
  });
});
