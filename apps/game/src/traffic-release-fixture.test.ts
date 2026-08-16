import { createSimulationSnapshot } from '@web-three-city/simulation-core';
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
  it('round-trips through WorldSaveV7 with real RCI Home/Work references intact', () => {
    const fixture = createTrafficReleaseFixture();
    const decoded = decodeWorldSave(fixture.save, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.value.simulation.absoluteTick).toBe(fixture.summary.startAbsoluteTick);
    expect(decoded.value.rci.population.citizens.map((citizen) => citizen.citizenId)).toEqual(
      fixture.summary.citizenIds,
    );
    const projected = createPresentCitizenMobilityProjection(
      decoded.value.rci,
      decoded.value.buildings,
      decoded.value.simulation.absoluteTick,
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
        world.simulation.absoluteTick,
      ),
      simulationBefore: world.simulation,
      simulationAfter: createSimulationSnapshot({
        revision: world.simulation.revision + 1,
        absoluteTick: 9,
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
    expect(result.mobility.trips.every((trip) => trip.status === 'Arrived')).toBe(true);
    expect(result.traffic.activeTrips).toHaveLength(0);
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
