import {
  createMobilitySnapshot,
  type MobilitySnapshotV1,
} from '@web-three-city/citizen-mobility-core';
import {
  absoluteTransportSecond,
  createTrafficSnapshotV2,
  type ActiveTransportTripV2,
  type TrafficGraph,
  type TrafficSnapshotV2,
} from '@web-three-city/traffic-core';
import { absoluteGameMinute } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import { CommittedWorldStore } from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { DefaultWorldTransactionCoordinator } from './application/world-transaction-coordinator.js';
import {
  commitTrafficTransportTransaction,
  planTrafficTransportTransaction,
} from './traffic-transport-transaction.js';

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 0,
  sourceBuildingRevision: 0,
  nodes: Object.freeze([
    { nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 },
    { nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 },
  ]),
  edges: Object.freeze([
    {
      edgeId: 'ab',
      fromNodeId: 'A',
      toNodeId: 'B',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 8,
      capacityUnits: 1,
    },
    {
      edgeId: 'walk-ab',
      fromNodeId: 'A',
      toNodeId: 'B',
      mode: 'Walk' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 8,
      capacityUnits: 1,
    },
  ]),
});

function mobility(): MobilitySnapshotV1 {
  return createMobilitySnapshot({
    schemaVersion: 1,
    revision: 1,
    policyVersion: 1,
    scheduleSeedVersion: 1,
    nextTripSequence: 2,
    citizenStates: [
      {
        citizenId: 'citizen-1',
        currentActivity: 'Travel',
        stationaryBuildingId: null,
        activeTripId: 'trip-1',
        scheduleCursorCycle: 0,
        nextBoundaryGameMinute: null,
      },
    ],
    trips: [
      {
        tripId: 'trip-1',
        citizenId: 'citizen-1',
        purpose: 'CommuteToWork',
        originBuildingId: 'home',
        destinationBuildingId: 'work',
        mode: 'Drive',
        departureGameMinute: absoluteGameMinute(480),
        status: 'Active',
        failureReason: null,
      },
    ],
  });
}

function traffic(
  driveMovementPhase: ActiveTransportTripV2['driveMovementPhase'] = 'WaitingForEntry',
  progressQ = 0,
  mode: 'Drive' | 'Walk' = 'Drive',
): TrafficSnapshotV2 {
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 1,
    policyVersion: 1,
    graphSourceRoadRevision: 0,
    graphSourceBuildingRevision: 0,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: absoluteTransportSecond(1_920),
      temporalPolicyVersion: 1,
    },
    activeTrips: [
      {
        tripId: 'trip-1',
        citizenId: 'citizen-1',
        mode,
        originBuildingId: 'home',
        destinationBuildingId: 'work',
        routeEdgeIds: [mode === 'Drive' ? 'ab' : 'walk-ab'],
        routeGraphRevision: 0,
        segmentIndex: 0,
        progressQ,
        lastStableNodeId: progressQ === 0 ? 'A' : 'B',
        queuedMovement: null,
        status: 'Active',
        failureReason: null,
        driveMovementPhase: mode === 'Drive' ? driveMovementPhase : null,
      },
    ],
  });
}

describe('authoritative short-trip publication', () => {
  it('keeps a real short Drive active at a transport checkpoint instead of completing it at departure', () => {
    const before = createApplicationFixture({ withCommercialInfrastructure: false });
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const plan = planTrafficTransportTransaction({
      world: coordinator.snapshot(),
      mobility: mobility(),
      traffic: traffic(),
      graph,
    });

    const committed = commitTrafficTransportTransaction(coordinator, plan);

    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;
    expect(committed.world.traffic.activeTrips[0]).toMatchObject({
      tripId: 'trip-1',
      status: 'Active',
      driveMovementPhase: 'Entering',
    });
    expect(committed.world.mobility.trips[0]?.status).toBe('Active');
  });

  it('keeps a real short Walk active at a transport checkpoint', () => {
    const before = createApplicationFixture({ withCommercialInfrastructure: false });
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const committed = commitTrafficTransportTransaction(
      coordinator,
      planTrafficTransportTransaction({
        world: coordinator.snapshot(),
        mobility: createMobilitySnapshot({
          ...mobility(),
          trips: [{ ...mobility().trips[0]!, mode: 'Walk' }],
        }),
        traffic: traffic(null, 0, 'Walk'),
        graph,
      }),
    );

    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;
    expect(committed.world.traffic.activeTrips[0]).toMatchObject({
      tripId: 'trip-1',
      mode: 'Walk',
      status: 'Active',
    });
    expect(committed.world.mobility.trips[0]?.status).toBe('Active');
  });

  it('settles a completed Leaving Drive with its Mobility trip and Citizen state in one publication', () => {
    const before = createApplicationFixture({ withCommercialInfrastructure: false });
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const committed = commitTrafficTransportTransaction(
      coordinator,
      planTrafficTransportTransaction({
        world: coordinator.snapshot(),
        mobility: mobility(),
        traffic: traffic('Leaving', 1_000_000),
        graph,
      }),
    );

    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;
    expect(committed.world.traffic.activeTrips).toEqual([]);
    expect(committed.world.mobility.trips[0]?.status).toBe('Arrived');
    expect(committed.world.mobility.citizenStates[0]).toMatchObject({
      currentActivity: 'Work',
      stationaryBuildingId: 'work',
      activeTripId: null,
    });
  });

  it('rejects an invalid arrival settlement without publishing the terminal Traffic candidate', () => {
    const before = createApplicationFixture({ withCommercialInfrastructure: false });
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const invalidMobility = createMobilitySnapshot({
      ...mobility(),
      citizenStates: [{ ...mobility().citizenStates[0]!, activeTripId: 'other-trip' }],
      trips: [{ ...mobility().trips[0]!, tripId: 'other-trip' }],
    });

    const rejected = commitTrafficTransportTransaction(
      coordinator,
      planTrafficTransportTransaction({
        world: coordinator.snapshot(),
        mobility: invalidMobility,
        traffic: traffic('Leaving', 1_000_000),
        graph,
      }),
    );

    expect(rejected).toMatchObject({ status: 'rejected', reason: 'world:invalid-candidate' });
    expect(fingerprintCommittedWorld(coordinator.snapshot())).toBe(
      fingerprintCommittedWorld(before),
    );
  });
});
