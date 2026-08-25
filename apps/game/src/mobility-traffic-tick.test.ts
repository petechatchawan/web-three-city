import { describe, expect, it } from 'vitest';
import {
  createEmptyMobilitySnapshot,
  reconcileMobilityCitizens,
  workStartGameMinuteForCitizen,
} from '@web-three-city/citizen-mobility-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import {
  createEmptyTrafficSnapshot,
  createTrafficSnapshot,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import { planMobilityTrafficTick } from './mobility-traffic-tick.js';

const E = 1 << 1;
const W = 1 << 3;

function simulation(absoluteGameMinute: number): SimulationSnapshot {
  return { absoluteGameMinute } as unknown as SimulationSnapshot;
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
    Object.freeze({
      x: 1,
      z: 1,
      definitionCode: 1,
      connectionMask: E,
      elevationStartQ: 0,
      elevationEndQ: 0,
    }),
    Object.freeze({
      x: 2,
      z: 1,
      definitionCode: 1,
      connectionMask: W,
      elevationStartQ: 0,
      elevationEndQ: 0,
    }),
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
      simulationBefore: simulation(7 * 60),
      simulationAfter: simulation(8 * 60),
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

  it('catches up a missed schedule boundary at the current minute without replaying history', () => {
    const citizenId = citizenDepartingAt(8 * 60);
    const result = planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore: createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
      citizensAfter: [
        { citizenId, homeBuildingId: 'home-1', workBuildingId: 'work-1', present: true },
      ],
      simulationBefore: simulation(9 * 60),
      simulationAfter: simulation(9 * 60 + 1),
      advanceTraffic: false,
      trafficSource: { roads, buildingAccess },
    });

    expect(result.mobility.trips).toHaveLength(1);
    expect(result.mobility.trips[0]).toMatchObject({
      citizenId,
      purpose: 'CommuteToWork',
      departureGameMinute: 9 * 60 + 1,
      status: 'Active',
    });
    expect(result.traffic.activeTrips).toHaveLength(1);
  });

  it('settles the same real trip without creating a duplicate Citizen authority', () => {
    const citizenId = citizenDepartingAt(8 * 60);
    const first = planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore: createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
      citizensAfter: [
        { citizenId, homeBuildingId: 'home-1', workBuildingId: 'work-1', present: true },
      ],
      simulationBefore: simulation(7 * 60),
      simulationAfter: simulation(8 * 60),
      trafficSource: { roads, buildingAccess },
    });
    const second = planMobilityTrafficTick({
      mobilityBefore: first.mobility,
      trafficBefore: first.traffic,
      citizensAfter: [
        { citizenId, homeBuildingId: 'home-1', workBuildingId: 'work-1', present: true },
      ],
      simulationBefore: simulation(8 * 60),
      simulationAfter: simulation(9 * 60),
      trafficSource: { roads, buildingAccess },
    });

    expect(second.mobility.citizenStates).toHaveLength(1);
    expect(second.mobility.citizenStates[0]?.citizenId).toBe(citizenId);
    expect(second.mobility.citizenStates[0]?.currentActivity).toBe('Work');
    expect(second.mobility.trips[0]?.status).toBe('Arrived');
    expect(second.traffic.activeTrips).toHaveLength(0);
  });

  it('rebases empty Traffic provenance without deriving graph cells when no Citizens exist', () => {
    const untouchedRoads = Object.freeze({
      roadRevision: 7,
      width: 8,
      height: 8,
      get cells(): never {
        throw new Error('empty-tick:traffic-graph-should-not-be-derived');
      },
    });
    const result = planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore: createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
      citizensAfter: Object.freeze([]),
      simulationBefore: simulation(8 * 60),
      simulationAfter: simulation(9 * 60),
      trafficSource: {
        roads: untouchedRoads,
        buildingAccess: Object.freeze({ buildingRevision: 9, accesses: Object.freeze([]) }),
      },
    });

    expect(result.mobility).toEqual(createEmptyMobilitySnapshot());
    expect(result.traffic).toMatchObject({
      graphSourceRoadRevision: 7,
      graphSourceBuildingRevision: 9,
      activeTrips: [],
    });
    expect(result.mobilityReceipts).toEqual([]);
    expect(result.trafficReceipts).toEqual([]);
  });

  it('does not re-read a canonical Traffic snapshot when static provenance is unchanged', () => {
    const canonical = createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 });
    let activeTripsReads = 0;
    const trafficBefore = Object.defineProperty({ ...canonical }, 'activeTrips', {
      configurable: false,
      enumerable: true,
      get: () => {
        activeTripsReads += 1;
        return canonical.activeTrips;
      },
    });

    planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore,
      citizensAfter: [
        { citizenId: 'citizen-1', homeBuildingId: null, workBuildingId: null, present: true },
      ],
      simulationBefore: simulation(0),
      simulationAfter: simulation(1),
      advanceTraffic: false,
      trafficSource: { roads, buildingAccess },
    });

    expect(activeTripsReads).toBe(1);
  });

  it('does not derive a traffic cost field when a minute has no planning work or progression', () => {
    const graph: TrafficGraph = Object.freeze({
      sourceRoadRevision: 1,
      sourceBuildingRevision: 1,
      nodes: Object.freeze([
        Object.freeze({ nodeId: 'walk-home', xQ: 0, yQ: 0, zQ: 0 }),
        Object.freeze({ nodeId: 'walk-work', xQ: 8_000, yQ: 0, zQ: 0 }),
      ]),
      edges: Object.freeze([
        Object.freeze({
          edgeId: 'walk-edge',
          fromNodeId: 'walk-home',
          toNodeId: 'walk-work',
          mode: 'Walk' as const,
          lengthQ: 8_000,
          freeFlowTravelSeconds: 1,
          capacityUnits: 1_000,
        }),
      ]),
    });
    const throwingCombinedGraph = Object.defineProperty({ ...graph }, 'edges', {
      configurable: false,
      enumerable: true,
      get: () => {
        throw new Error('traffic-cost-field-should-not-be-derived');
      },
    }) as TrafficGraph;
    const trafficBefore = createTrafficSnapshot({
      schemaVersion: 1,
      revision: 1,
      policyVersion: 1,
      graphSourceRoadRevision: 1,
      graphSourceBuildingRevision: 1,
      activeTrips: [
        Object.freeze({
          tripId: 'trip-active',
          citizenId: 'citizen-active',
          mode: 'Walk' as const,
          originBuildingId: 'home-1',
          destinationBuildingId: 'work-1',
          routeEdgeIds: Object.freeze(['walk-edge']),
          routeGraphRevision: 1,
          segmentIndex: 0,
          progressQ: 0,
          lastStableNodeId: 'walk-home',
          queuedMovement: null,
          status: 'Active' as const,
          failureReason: null,
        }),
      ],
    });

    const result = planMobilityTrafficTick({
      mobilityBefore: createEmptyMobilitySnapshot(),
      trafficBefore,
      citizensAfter: Object.freeze([]),
      simulationBefore: simulation(0),
      simulationAfter: simulation(1),
      advanceTraffic: false,
      trafficSource: {
        roads,
        buildingAccess: Object.freeze({ buildingRevision: 1, accesses: [] }),
      },
      trafficGraphs: { pedestrian: graph, vehicle: graph, combined: throwingCombinedGraph },
    });

    expect(result.traffic.activeTrips).toHaveLength(1);
  });

  it('uses indexed mobility state lookup for catch-up eligibility', () => {
    const citizen = {
      citizenId: 'citizen-indexed-state',
      homeBuildingId: null,
      workBuildingId: null,
      present: true,
    };
    const baseline = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens: [citizen],
    }).snapshot;
    const mobilityBefore = Object.freeze({
      ...baseline,
      citizenStates: new Proxy(baseline.citizenStates, {
        get(target, property, receiver) {
          if (property === 'find') {
            throw new Error('mobility-state-linear-lookup');
          }
          return Reflect.get(target, property, receiver);
        },
      }),
    });

    expect(() =>
      planMobilityTrafficTick({
        mobilityBefore,
        trafficBefore: createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
        citizensAfter: [citizen],
        simulationBefore: simulation(0),
        simulationAfter: simulation(1),
        advanceTraffic: false,
        trafficSource: { roads, buildingAccess },
      }),
    ).not.toThrow('mobility-state-linear-lookup');
  });
});
