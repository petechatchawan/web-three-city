import { describe, expect, it } from 'vitest';
import { absoluteGameMinute } from '@web-three-city/simulation-core';
import {
  chooseMobilityMode,
  collectDueMobilityBoundaries,
  commitPlannedMobilityTrip,
  createEmptyMobilitySnapshot,
  planMobilityBoundaries,
  planMobilityCatchUp,
  reconcileMobilityCitizens,
  settleMobilityTrip,
  workStartGameMinuteForCitizen,
} from '../src/index.js';

const citizen = Object.freeze({
  citizenId: 'citizen-42',
  homeBuildingId: 'home-1',
  workBuildingId: 'work-1',
  present: true,
});

describe('Citizen Mobility commute planning', () => {
  it('stably distributes work departure inside 07:00–09:00', () => {
    const first = workStartGameMinuteForCitizen('citizen-42', 2);
    const second = workStartGameMinuteForCitizen('citizen-42', 2);
    expect(first).toBe(second);
    expect(first % (24 * 60)).toBeGreaterThanOrEqual(7 * 60);
    expect(first % (24 * 60)).toBeLessThanOrEqual(9 * 60);
  });

  it('collects due boundaries in explicit game-minute order', () => {
    const citizens = Array.from({ length: 32 }, (_, index) =>
      Object.freeze({
        citizenId: `citizen-${String(index).padStart(3, '0')}`,
        homeBuildingId: 'home-1',
        workBuildingId: 'work-1',
        present: true,
      }),
    );
    const boundaries = collectDueMobilityBoundaries({
      citizens,
      fromGameMinuteExclusive: absoluteGameMinute(6 * 60),
      toGameMinuteInclusive: absoluteGameMinute(10 * 60),
    });
    expect(boundaries.length).toBe(32);
    expect([...boundaries].sort((a, b) => a.atGameMinute - b.atGameMinute)).toEqual(boundaries);
    expect(new Set(boundaries.map((entry) => entry.atGameMinute)).size).toBeGreaterThan(1);
  });

  it('plans Home → Work against the latest authoritative destination', () => {
    const initialized = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens: [citizen],
    }).snapshot;
    const boundary = collectDueMobilityBoundaries({
      citizens: [citizen],
      fromGameMinuteExclusive: absoluteGameMinute(6 * 60),
      toGameMinuteInclusive: absoluteGameMinute(10 * 60),
    })[0]!;
    const plan = planMobilityBoundaries({
      snapshot: initialized,
      boundaries: [boundary],
      citizens: [{ ...citizen, workBuildingId: 'work-latest' }],
    });
    expect(plan.planningRequests).toHaveLength(1);
    expect(plan.planningRequests[0]).toMatchObject({
      citizenId: 'citizen-42',
      originBuildingId: 'home-1',
      destinationBuildingId: 'work-latest',
      purpose: 'CommuteToWork',
    });
  });

  it('selects lowest generalized cost and exact tie prefers Walk', () => {
    expect(
      chooseMobilityMode([
        { mode: 'Walk', available: true, generalizedCostSeconds: 120 },
        { mode: 'Drive', available: true, generalizedCostSeconds: 120 },
      ]),
    ).toBe('Walk');
    expect(
      chooseMobilityMode([
        { mode: 'Walk', available: true, generalizedCostSeconds: 200 },
        { mode: 'Drive', available: true, generalizedCostSeconds: 90 },
      ]),
    ).toBe('Drive');
  });

  it('commits one active mobility trip then settles back to Work', () => {
    const initialized = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens: [citizen],
    }).snapshot;
    const boundary = collectDueMobilityBoundaries({
      citizens: [citizen],
      fromGameMinuteExclusive: absoluteGameMinute(6 * 60),
      toGameMinuteInclusive: absoluteGameMinute(10 * 60),
    })[0]!;
    const request = planMobilityBoundaries({
      snapshot: initialized,
      boundaries: [boundary],
      citizens: [citizen],
    }).planningRequests[0]!;
    const travelling = commitPlannedMobilityTrip({
      snapshot: initialized,
      request,
      candidates: [
        { mode: 'Walk', available: true, generalizedCostSeconds: 300 },
        { mode: 'Drive', available: true, generalizedCostSeconds: 100 },
      ],
    });
    expect(travelling.citizenStates[0]).toMatchObject({
      currentActivity: 'Travel',
      activeTripId: request.tripId,
    });
    expect(travelling.trips[0]).toMatchObject({ status: 'Active', mode: 'Drive' });

    const arrived = settleMobilityTrip({
      snapshot: travelling,
      tripId: request.tripId,
      outcome: 'Arrived',
    });
    expect(arrived.citizenStates[0]).toMatchObject({
      currentActivity: 'Work',
      stationaryBuildingId: 'work-1',
      activeTripId: null,
    });
    expect(arrived.trips[0]?.status).toBe('Arrived');
  });

  it('does not queue a later boundary during travel and creates one current-activity catch-up after settlement', () => {
    const initialized = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens: [citizen],
    }).snapshot;
    const outbound = planMobilityBoundaries({
      snapshot: initialized,
      boundaries: [
        {
          citizenId: citizen.citizenId,
          atGameMinute: absoluteGameMinute(480),
          nextActivity: 'Work',
        },
      ],
      citizens: [citizen],
    }).planningRequests[0]!;
    const travelling = commitPlannedMobilityTrip({
      snapshot: initialized,
      request: outbound,
      candidates: [{ mode: 'Walk', available: true, generalizedCostSeconds: 100 }],
    });

    const laterDueWhileTravelling = planMobilityBoundaries({
      snapshot: travelling,
      boundaries: [
        {
          citizenId: citizen.citizenId,
          atGameMinute: absoluteGameMinute(1020),
          nextActivity: 'Home',
        },
      ],
      citizens: [citizen],
    });
    expect(laterDueWhileTravelling.planningRequests).toEqual([]);
    expect(laterDueWhileTravelling.proposedSnapshot.nextTripSequence).toBe(2);

    const settled = settleMobilityTrip({
      snapshot: travelling,
      tripId: outbound.tripId,
      outcome: 'Arrived',
    });
    const catchUp = planMobilityCatchUp({
      snapshot: settled,
      citizens: [citizen],
      currentGameMinute: absoluteGameMinute(1020),
    });

    expect(catchUp.planningRequests).toEqual([
      expect.objectContaining({
        tripId: 'mobility-trip-0000000002',
        citizenId: citizen.citizenId,
        purpose: 'CommuteHome',
        originBuildingId: 'work-1',
        destinationBuildingId: 'home-1',
        departureGameMinute: 1020,
      }),
    ]);
  });

  it('does not turn a stale desired-activity boundary into a duplicate trip', () => {
    const initialized = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens: [{ ...citizen, homeBuildingId: null }],
    }).snapshot;

    const plan = planMobilityBoundaries({
      snapshot: initialized,
      boundaries: [
        {
          citizenId: citizen.citizenId,
          atGameMinute: absoluteGameMinute(480),
          nextActivity: 'Work',
        },
      ],
      citizens: [citizen],
    });

    expect(plan.planningRequests).toEqual([]);
    expect(plan.proposedSnapshot.nextTripSequence).toBe(1);
  });

  it('cancels active travel when Citizen leaves the city without deleting RCI identity', () => {
    const initialized = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens: [citizen],
    }).snapshot;
    const boundary = collectDueMobilityBoundaries({
      citizens: [citizen],
      fromGameMinuteExclusive: absoluteGameMinute(6 * 60),
      toGameMinuteInclusive: absoluteGameMinute(10 * 60),
    })[0]!;
    const request = planMobilityBoundaries({
      snapshot: initialized,
      boundaries: [boundary],
      citizens: [citizen],
    }).planningRequests[0]!;
    const travelling = commitPlannedMobilityTrip({
      snapshot: initialized,
      request,
      candidates: [{ mode: 'Walk', available: true, generalizedCostSeconds: 100 }],
    });
    const result = reconcileMobilityCitizens({
      snapshot: travelling,
      citizens: [{ ...citizen, present: false }],
    });
    expect(result.snapshot.citizenStates).toHaveLength(0);
    expect(result.cancelledTripIds).toEqual([request.tripId]);
    expect(result.snapshot.trips[0]?.status).toBe('Cancelled');
  });
});
