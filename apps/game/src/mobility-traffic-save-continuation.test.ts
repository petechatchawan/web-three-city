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
import { decodeWorldSave, encodeWorldSaveV7 } from './world-save.js';

function simulationAt(base: ReturnType<typeof createTrafficReleaseFixture>['world']['simulation'], absoluteTick: number) {
  return createSimulationSnapshot({
    revision: base.revision + Math.max(1, absoluteTick - base.absoluteTick),
    absoluteTick,
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
  return planMobilityTrafficTick({
    mobilityBefore: mobility,
    trafficBefore: traffic,
    citizensAfter: createPresentCitizenMobilityProjection(world.rci, world.buildings, afterTick),
    simulationBefore: simulationAt(world.simulation, beforeTick),
    simulationAfter: simulationAt(world.simulation, afterTick),
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
}

describe('Mobility/Traffic WorldSaveV7 continuation', () => {
  it('matches continuous morning+return commute after a midday save/decode boundary', () => {
    const fixture = createTrafficReleaseFixture();
    const continuous = progress(
      fixture,
      fixture.world.mobility,
      fixture.world.traffic,
      fixture.summary.startAbsoluteTick,
      17,
    );

    const beforeSave = progress(
      fixture,
      fixture.world.mobility,
      fixture.world.traffic,
      fixture.summary.startAbsoluteTick,
      12,
    );
    const middaySimulation = simulationAt(fixture.world.simulation, 12);
    const encoded = encodeWorldSaveV7(
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

    const resumed = planMobilityTrafficTick({
      mobilityBefore: decoded.value.mobility,
      trafficBefore: decoded.value.traffic,
      citizensAfter: createPresentCitizenMobilityProjection(
        decoded.value.rci,
        decoded.value.buildings,
        17,
      ),
      simulationBefore: decoded.value.simulation,
      simulationAfter: simulationAt(fixture.world.simulation, 17),
      trafficSource: {
        roads: createRoadTrafficSourceProjectionFromEnvironment(
          fixture.world.roads,
          fixture.world.environments.building,
        ),
        buildingAccess: createBuildingTrafficAccessProjection(
          fixture.world.buildings,
          fixture.world.roads,
          fixture.world.environments.building,
        ),
      },
    });

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
