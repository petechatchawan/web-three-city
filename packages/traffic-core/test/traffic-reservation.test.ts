import { describe, expect, it } from 'vitest';
import * as trafficCore from '../src/index.js';
import type { ActiveTransportTripV2, TrafficGraph, TrafficSnapshotV2 } from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

type TrafficReservationApi = Readonly<{
  createTrafficSnapshotV2: (input: TrafficSnapshotV2) => TrafficSnapshotV2;
  accrueStaticAccessServiceCredit: (
    input: Readonly<{
      currentCredit: number;
      elapsedTransportSeconds: number;
      accessServiceRatePerTransportSecond: number;
      congestionMilli: number;
      loadMilli: number;
      queueLength: number;
    }>,
  ) => number;
  createTrafficReservationResourceId: (
    kind: 'IngressFootprint' | 'ReceivingAdmission',
    subjectId: string,
  ) => string;
  createTrafficReservationLedger: () => unknown;
  acquireTrafficReservationBundle: (
    input: Readonly<{
      ledger: unknown;
      tripId: string;
      resourceIds: readonly string[];
    }>,
  ) => Readonly<{ granted: boolean; ledger: unknown }>;
  trafficReservationOwnersByResource: (ledger: unknown) => ReadonlyMap<string, string>;
  createTrafficReservationLedgerFromTrips: (trips: readonly ReservationTrip[]) => unknown;
  terminateDriveWithEntryReservation: (
    trip: ReservationTrip,
    status: 'Failed' | 'Cancelled',
  ) => ReservationTrip;
  advanceTrafficQuantum: (
    input: Readonly<{
      snapshot: TrafficSnapshotV2;
      graph: TrafficGraph;
      entryAdmission: Readonly<{ accessServiceRatePerTransportSecond: number }>;
    }>,
  ) => Readonly<{
    snapshot: TrafficSnapshotV2;
    receipt: Readonly<{ releasedTripIds: readonly string[] }>;
  }>;
}>;

const api = trafficCore as unknown as TrafficReservationApi;

type ReservationTrip = ActiveTransportTripV2 &
  Readonly<{
    entryServiceCredit?: number;
    entryReservationResourceIds?: readonly string[];
  }>;

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 1,
  sourceBuildingRevision: 1,
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
  ]),
});

function driveTrip(overrides: Partial<ReservationTrip> = {}): ReservationTrip {
  return Object.freeze({
    tripId: 'waiting-drive',
    citizenId: 'citizen-waiting-drive',
    mode: 'Drive' as const,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['ab']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 0,
    lastStableNodeId: 'A',
    queuedMovement: null,
    status: 'Active' as const,
    failureReason: null,
    driveMovementPhase: 'WaitingForEntry' as const,
    entryServiceCredit: 0,
    entryReservationResourceIds: Object.freeze([]),
    ...overrides,
  });
}

function snapshot(activeTrips: readonly ReservationTrip[]): TrafficSnapshotV2 {
  return api.createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 0,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: trafficCore.absoluteTransportSecond(1_920),
      temporalPolicyVersion: 1,
    },
    activeTrips,
  });
}

describe('Traffic entry reservations', () => {
  it('accrues static access service credit independently of live congestion', () => {
    const uncongestedCredit = api.accrueStaticAccessServiceCredit({
      currentCredit: 1,
      elapsedTransportSeconds: 3,
      accessServiceRatePerTransportSecond: 2,
      congestionMilli: 0,
      loadMilli: 0,
      queueLength: 0,
    });
    const congestedCredit = api.accrueStaticAccessServiceCredit({
      currentCredit: 1,
      elapsedTransportSeconds: 3,
      accessServiceRatePerTransportSecond: 2,
      congestionMilli: 1_000,
      loadMilli: 1_000,
      queueLength: 99,
    });

    expect(uncongestedCredit).toBe(7);
    expect(congestedCredit).toBe(7);
  });

  it('acquires ingress and receiving resources all-or-nothing', () => {
    const ingress = api.createTrafficReservationResourceId('IngressFootprint', 'access-home');
    const receiving = api.createTrafficReservationResourceId('ReceivingAdmission', 'ab');
    const initial = api.createTrafficReservationLedger();
    const first = api.acquireTrafficReservationBundle({
      ledger: initial,
      tripId: 'trip-a',
      resourceIds: [ingress, receiving],
    });
    const second = api.acquireTrafficReservationBundle({
      ledger: first.ledger,
      tripId: 'trip-b',
      resourceIds: [ingress, receiving],
    });

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect([...api.trafficReservationOwnersByResource(second.ledger)]).toEqual([
      [ingress, 'trip-a'],
      [receiving, 'trip-a'],
    ]);
  });

  it('keeps a credited Drive WaitingForEntry when its first receiving footprint is blocked', () => {
    const result = api.advanceTrafficQuantum({
      snapshot: snapshot([
        driveTrip({
          tripId: 'lane-occupant',
          citizenId: 'citizen-lane-occupant',
          driveMovementPhase: 'Travelling',
          entryServiceCredit: 0,
          progressQ: 0,
        }),
        driveTrip({ entryServiceCredit: 2 }),
      ]),
      graph,
      entryAdmission: { accessServiceRatePerTransportSecond: 1 },
    });
    const waiting = result.snapshot.activeTrips.find(
      (trip) => trip.tripId === 'waiting-drive',
    ) as ReservationTrip;

    expect(waiting.driveMovementPhase).toBe('WaitingForEntry');
    expect(waiting.entryServiceCredit).toBe(3);
    expect(waiting.entryReservationResourceIds).toEqual([]);
  });

  it('holds a stalled entry bundle and releases it only after rear clearance', () => {
    const resourceIds = Object.freeze(['IngressFootprint:home', 'ReceivingAdmission:ab']);
    const stalled = api.advanceTrafficQuantum({
      snapshot: snapshot([
        driveTrip({
          tripId: 'stalled-entry',
          citizenId: 'citizen-stalled-entry',
          driveMovementPhase: 'Travelling',
          entryReservationResourceIds: resourceIds,
          progressQ: 0,
        }),
        driveTrip({
          tripId: 'stopped-leader',
          citizenId: 'citizen-stopped-leader',
          driveMovementPhase: 'Travelling',
          progressQ: 900_000,
          queuedMovement: {
            fromEdgeId: 'ab',
            toEdgeId: 'ab',
            arrivedAtTransportSecond: trafficCore.absoluteTransportSecond(1_900),
          },
        }),
      ]),
      graph,
      entryAdmission: { accessServiceRatePerTransportSecond: 1 },
    });
    const cleared = api.advanceTrafficQuantum({
      snapshot: snapshot([
        driveTrip({
          tripId: 'clearing-entry',
          citizenId: 'citizen-clearing-entry',
          driveMovementPhase: 'Travelling',
          entryReservationResourceIds: resourceIds,
          progressQ: 124_999,
        }),
      ]),
      graph,
      entryAdmission: { accessServiceRatePerTransportSecond: 1 },
    });

    expect(
      (
        stalled.snapshot.activeTrips.find(
          (trip) => trip.tripId === 'stalled-entry',
        ) as ReservationTrip
      ).entryReservationResourceIds,
    ).toEqual(resourceIds);
    expect(stalled.receipt.releasedTripIds).toEqual([]);
    expect(
      (
        cleared.snapshot.activeTrips.find(
          (trip) => trip.tripId === 'clearing-entry',
        ) as ReservationTrip
      ).entryReservationResourceIds,
    ).toEqual([]);
    expect(cleared.receipt.releasedTripIds).toEqual(['clearing-entry']);
  });

  it('releases entry ownership in the same cancellation transition', () => {
    const cancelled = api.terminateDriveWithEntryReservation(
      driveTrip({
        driveMovementPhase: 'Travelling',
        entryReservationResourceIds: Object.freeze([
          'IngressFootprint:home',
          'ReceivingAdmission:ab',
        ]),
      }),
      'Cancelled',
    );

    expect(cancelled).toMatchObject({
      status: 'Cancelled',
      driveMovementPhase: null,
      entryReservationResourceIds: [],
    });
    expect([
      ...api.trafficReservationOwnersByResource(
        api.createTrafficReservationLedgerFromTrips([cancelled]),
      ),
    ]).toEqual([]);
  });

  it('releases entry ownership in the same failure transition', () => {
    const failed = api.terminateDriveWithEntryReservation(
      driveTrip({
        driveMovementPhase: 'Travelling',
        entryReservationResourceIds: Object.freeze([
          'IngressFootprint:home',
          'ReceivingAdmission:ab',
        ]),
      }),
      'Failed',
    );

    expect(failed).toMatchObject({
      status: 'Failed',
      failureReason: 'UnreachableDestination',
      driveMovementPhase: null,
      entryReservationResourceIds: [],
    });
    expect([
      ...api.trafficReservationOwnersByResource(
        api.createTrafficReservationLedgerFromTrips([failed]),
      ),
    ]).toEqual([]);
  });
});
