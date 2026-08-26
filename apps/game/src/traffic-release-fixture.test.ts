import {
  absoluteGameMinute,
  addGameMinutes,
  createSimulationSnapshot,
  deriveMacroHourIndex,
  gameMinuteDuration,
  gameMinuteValue,
  macroHourIndex,
} from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import {
  isTrafficJourneyDepartureReceipt,
  planMobilityTrafficTick,
} from './mobility-traffic-tick.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';
import { decodeWorldSave } from './world-save.js';

describe('Citizen Mobility & Traffic release fixture', () => {
  it('reuses the immutable citizen projection within the same macro-hour source', () => {
    const fixture = createTrafficReleaseFixture();
    const first = createPresentCitizenMobilityProjection(
      fixture.world.rci,
      fixture.world.buildings,
      macroHourIndex(9),
    );
    const second = createPresentCitizenMobilityProjection(
      fixture.world.rci,
      fixture.world.buildings,
      macroHourIndex(9),
    );

    expect(second).toBe(first);
  });

  it('round-trips through WorldSaveV7 with real RCI Home/Work references intact', () => {
    const fixture = createTrafficReleaseFixture();
    const decoded = decodeWorldSave(fixture.save, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.value.simulation.absoluteGameMinute).toBe(
      fixture.summary.startAbsoluteGameMinute,
    );
    expect(decoded.value.rci.population.citizens.map((citizen) => citizen.citizenId)).toEqual(
      fixture.world.rci.population.citizens.map((citizen) => citizen.citizenId),
    );
    const projected = createPresentCitizenMobilityProjection(
      decoded.value.rci,
      decoded.value.buildings,
      deriveMacroHourIndex(decoded.value.simulation.absoluteGameMinute),
    );
    for (const citizen of projected) {
      expect(citizen.homeBuildingId).toBe(fixture.summary.homeBuildingByCitizen[citizen.citizenId]);
      expect(citizen.workBuildingId).toBe(fixture.summary.workBuildingByCitizen[citizen.citizenId]);
    }
    expect(decoded.value.traffic.activeTrips).toHaveLength(0);
  });

  it('generates deterministic mixed Walk/Drive commute departures between 07:00 and 09:00', () => {
    const fixture = createTrafficReleaseFixture();
    const world = fixture.world;
    const result = planMobilityTrafficTick({
      mobilityBefore: world.mobility,
      trafficBefore: world.traffic,
      citizensAfter: createPresentCitizenMobilityProjection(
        world.rci,
        world.buildings,
        deriveMacroHourIndex(world.simulation.absoluteGameMinute),
      ),
      simulationBefore: createSimulationSnapshot({
        revision: world.simulation.revision,
        absoluteGameMinute: gameMinuteValue(world.simulation.absoluteGameMinute) - 1,
        growthSequence: world.simulation.growthSequence,
      }),
      simulationAfter: createSimulationSnapshot({
        revision: world.simulation.revision + 1,
        absoluteGameMinute: 9 * 60,
        growthSequence: world.simulation.growthSequence,
      }),
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
    const departures = result.trafficReceipts.filter(isTrafficJourneyDepartureReceipt);
    expect(departures).toHaveLength(fixture.summary.citizenIds.length);
    expect(departures.every((receipt) => receipt.departureGameMinute >= 420)).toBe(true);
    expect(departures.every((receipt) => receipt.departureGameMinute <= 540)).toBe(true);

    const modeByCitizen = new Map(departures.map((receipt) => [receipt.citizenId, receipt.mode]));
    for (const citizenId of fixture.summary.walkCitizenIds) {
      expect(modeByCitizen.get(citizenId)).toBe('Walk');
    }
    for (const citizenId of fixture.summary.driveCitizenIds) {
      expect(modeByCitizen.get(citizenId)).toBe('Drive');
    }
    expect(
      result.mobility.trips.every((trip) => trip.status === 'Active' || trip.status === 'Arrived'),
    ).toBe(true);
    expect(
      result.traffic.activeTrips.every((trip) =>
        result.mobility.trips.some((mobilityTrip) => mobilityTrip.tripId === trip.tripId),
      ),
    ).toBe(true);
  });

  it('continues hourly fixture ticks through commute home', () => {
    const fixture = createTrafficReleaseFixture();
    const world = fixture.world;
    let mobility = world.mobility;
    let traffic = world.traffic;
    let previousMinute = world.simulation.absoluteGameMinute;
    for (const nextMinute of [
      addGameMinutes(world.simulation.absoluteGameMinute, gameMinuteDuration(1)),
      absoluteGameMinute(19 * 60),
    ]) {
      if (nextMinute <= previousMinute) continue;
      const result = planMobilityTrafficTick({
        mobilityBefore: mobility,
        trafficBefore: traffic,
        citizensAfter: createPresentCitizenMobilityProjection(
          world.rci,
          world.buildings,
          deriveMacroHourIndex(nextMinute),
        ),
        simulationBefore: createSimulationSnapshot({
          revision:
            world.simulation.revision + previousMinute - world.simulation.absoluteGameMinute,
          absoluteGameMinute: previousMinute,
          growthSequence: world.simulation.growthSequence,
        }),
        simulationAfter: createSimulationSnapshot({
          revision: world.simulation.revision + nextMinute - world.simulation.absoluteGameMinute,
          absoluteGameMinute: nextMinute,
          growthSequence: world.simulation.growthSequence,
        }),
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
      mobility = result.mobility;
      traffic = result.traffic;
      previousMinute = nextMinute;
    }
    const finished = { mobility, traffic };
    expect(finished.mobility.trips).toHaveLength(fixture.summary.citizenIds.length * 2);
    expect(finished.mobility.trips.filter((trip) => trip.purpose === 'CommuteHome')).toHaveLength(
      fixture.summary.citizenIds.length,
    );
    expect(finished.mobility.citizenStates.every((state) => state.currentActivity === 'Home')).toBe(
      true,
    );
  });

  it('contains a deterministic alternate Road corridor around the primary recovery cut', () => {
    const fixture = createTrafficReleaseFixture();
    expect(fixture.summary.primaryRoadCutCell).toEqual({ x: 64, z: 64 });
    expect(fixture.summary.alternateRouteCells.some((cell) => cell.x === 64 && cell.z === 68)).toBe(
      true,
    );
    expect(fixture.summary.alternateRouteCells.some((cell) => cell.x === 40 && cell.z === 64)).toBe(
      true,
    );
    expect(fixture.summary.alternateRouteCells.some((cell) => cell.x === 90 && cell.z === 64)).toBe(
      true,
    );
  });
});
