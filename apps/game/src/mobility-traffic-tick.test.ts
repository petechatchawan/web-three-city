import { describe, expect, it } from 'vitest';
import {
  createEmptyMobilitySnapshot,
  workStartGameMinuteForCitizen,
} from '@web-three-city/citizen-mobility-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { createEmptyTrafficSnapshot } from '@web-three-city/traffic-core';
import { planMobilityTrafficTick } from './mobility-traffic-tick.js';

const E = 1 << 1;
const W = 1 << 3;

function simulation(absoluteTick: number): SimulationSnapshot {
  return { absoluteTick } as unknown as SimulationSnapshot;
}

function citizenDepartingAt(minuteOfDay: number): string {
  for (let index = 0; index < 50_000; index += 1) {
    const citizenId = `citizen-${index}`;
    if (workStartGameMinuteForCitizen(citizenId, 0) % (24 * 60) === minuteOfDay) return citizenId;
  }
  throw new Error(`test-fixture:no-citizen-departs-at-${minuteOfDay}`);
}

const roads = Object.freeze({
  roadRevision: 1,
  width: 8,
  height: 8,
  cells: Object.freeze([
    Object.freeze({ x: 1, z: 1, definitionCode: 1, connectionMask: E, elevationStartQ: 0, elevationEndQ: 0 }),
    Object.freeze({ x: 2, z: 1, definitionCode: 1, connectionMask: W, elevationStartQ: 0, elevationEndQ: 0 }),
  ]),
});

const buildingAccess = Object.freeze({
  buildingRevision: 1,
  accesses: Object.freeze([
    Object.freeze({
      buildingInstanceId: 'home-1',
      frontageRoadX: 1,
      frontageRoadZ: 1,
      frontageDirection: 'N' as const,
      entranceXQ: 12_000,
      entranceYQ: 0,
      entranceZQ: 8_000,
    }),
    Object.freeze({
      buildingInstanceId: 'work-1',
      frontageRoadX: 2,
      frontageRoadZ: 1,
      frontageDirection: 'N' as const,
      entranceXQ: 20_000,
      entranceYQ: 0,
      entranceZQ: 8_000,
    }),
  ]),
});

describe('planMobilityTrafficTick', () => {
  it('commits a real trip at an exact sub-hour boundary and preserves it as logical Traffic', () => {
    const citizenId = citizenDepartingAt(8 * 60);
    const result = planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore: createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
      citizensAfter: [
        { citizenId, homeBuildingId: 'home-1', workBuildingId: 'work-1', present: true },
      ],
      simulationBefore: simulation(7),
      simulationAfter: simulation(8),
      trafficSource: { roads, buildingAccess },
    });

    expect(result.mobility.trips).toHaveLength(1);
    expect(result.mobility.trips[0]).toMatchObject({
      citizenId,
      originBuildingId: 'home-1',
      destinationBuildingId: 'work-1',
      status: 'Active',
    });
    expect(result.traffic.activeTrips).toHaveLength(1);
    expect(result.traffic.activeTrips[0]).toMatchObject({
      citizenId,
      tripId: result.mobility.trips[0]?.tripId,
      status: 'Active',
    });
  });

  it('settles the same real trip without creating a duplicate Citizen authority', () => {
    const citizenId = citizenDepartingAt(8 * 60);
    const first = planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore: createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
      citizensAfter: [
        { citizenId, homeBuildingId: 'home-1', workBuildingId: 'work-1', present: true },
      ],
      simulationBefore: simulation(7),
      simulationAfter: simulation(8),
      trafficSource: { roads, buildingAccess },
    });
    const second = planMobilityTrafficTick({
      mobilityBefore: first.mobility,
      trafficBefore: first.traffic,
      citizensAfter: [
        { citizenId, homeBuildingId: 'home-1', workBuildingId: 'work-1', present: true },
      ],
      simulationBefore: simulation(8),
      simulationAfter: simulation(9),
      trafficSource: { roads, buildingAccess },
    });

    expect(second.mobility.citizenStates).toHaveLength(1);
    expect(second.mobility.citizenStates[0]?.citizenId).toBe(citizenId);
    expect(second.mobility.citizenStates[0]?.currentActivity).toBe('Work');
    expect(second.mobility.trips[0]?.status).toBe('Arrived');
    expect(second.traffic.activeTrips).toHaveLength(0);
  });
});
