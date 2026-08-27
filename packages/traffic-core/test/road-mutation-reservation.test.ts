import { describe, expect, it } from 'vitest';
import * as trafficCore from '../src/index.js';
import type { ActiveTransportTripV2, TrafficGraph, TrafficSnapshotV2 } from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

type RoadMutationApi = Readonly<{
  createTrafficSnapshotV2: (input: TrafficSnapshotV2) => TrafficSnapshotV2;
  createTrafficReservationLedgerFromTrips: (
    trips: readonly ActiveTransportTripV2[],
  ) => Readonly<{ ownersByResource: ReadonlyMap<string, string> }>;
  reconcileTrafficReservationsAfterRoadMutation: (
    input: Readonly<{
      snapshot: TrafficSnapshotV2;
      graph: TrafficGraph;
      destinationAccessNodeIdByTripId: ReadonlyMap<string, string | null>;
      cancelledTripIds?: ReadonlySet<string>;
    }>,
  ) => TrafficSnapshotV2;
}>;

const api = trafficCore as unknown as RoadMutationApi;

function graph(edges: readonly TrafficGraph['edges'][number][], revision: number): TrafficGraph {
  return Object.freeze({
    sourceRoadRevision: revision,
    sourceBuildingRevision: 1,
    nodes: Object.freeze([
      { nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 },
      { nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 },
      { nodeId: 'C', xQ: 16_000, yQ: 0, zQ: 0 },
      { nodeId: 'D', xQ: 8_000, yQ: 0, zQ: 8_000 },
    ]),
    edges: Object.freeze(edges),
  });
}

const ab = Object.freeze({
  edgeId: 'ab',
  fromNodeId: 'A',
  toNodeId: 'B',
  mode: 'Drive' as const,
  lengthQ: 8_000,
  freeFlowTravelSeconds: 8,
  capacityUnits: 1,
});
const bc = Object.freeze({
  edgeId: 'bc',
  fromNodeId: 'B',
  toNodeId: 'C',
  mode: 'Drive' as const,
  lengthQ: 8_000,
  freeFlowTravelSeconds: 8,
  capacityUnits: 1,
});
const bd = Object.freeze({
  edgeId: 'bd',
  fromNodeId: 'B',
  toNodeId: 'D',
  mode: 'Drive' as const,
  lengthQ: 8_000,
  freeFlowTravelSeconds: 8,
  capacityUnits: 1,
});
const dc = Object.freeze({
  edgeId: 'dc',
  fromNodeId: 'D',
  toNodeId: 'C',
  mode: 'Drive' as const,
  lengthQ: 8_000,
  freeFlowTravelSeconds: 8,
  capacityUnits: 1,
});

function occupiedTrip(overrides: Partial<ActiveTransportTripV2> = {}): ActiveTransportTripV2 {
  return Object.freeze({
    tripId: 'drive-1',
    citizenId: 'citizen-1',
    mode: 'Drive',
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['ab', 'bc']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 1_000_000,
    lastStableNodeId: 'B',
    queuedMovement: null,
    status: 'Active',
    failureReason: null,
    driveMovementPhase: 'Travelling',
    entryServiceCredit: 0,
    entryReservationResourceIds: Object.freeze(['IngressFootprint:home']),
    activeNodeTraversal: Object.freeze({
      nodeId: 'B',
      traversalClass: 'ConflictJunction',
      incomingEdgeId: 'ab',
      outgoingEdgeId: 'bc',
      movementKind: 'Straight',
      reservedResourceIds: Object.freeze([
        'IntersectionConflictZone:B:center',
        'ReceivingAdmission:bc',
      ]),
      progressQ: 0,
    }),
    ...overrides,
  });
}

function snapshot(trip: ActiveTransportTripV2): TrafficSnapshotV2 {
  return api.createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 3,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: trafficCore.absoluteTransportSecond(1_920),
      temporalPolicyVersion: 1,
    },
    activeTrips: [trip],
  });
}

describe('Road mutation reservation reconciliation', () => {
  it('preserves occupied traversal identity and reservation ownership across a definition-only Road upgrade', () => {
    const reconciled = api.reconcileTrafficReservationsAfterRoadMutation({
      snapshot: snapshot(occupiedTrip()),
      graph: graph([ab, bc], 2),
      destinationAccessNodeIdByTripId: new Map([['drive-1', 'C']]),
    });

    expect(reconciled.activeTrips[0]).toMatchObject({
      tripId: 'drive-1',
      routeEdgeIds: ['ab', 'bc'],
      activeNodeTraversal: {
        nodeId: 'B',
        reservedResourceIds: ['IntersectionConflictZone:B:center', 'ReceivingAdmission:bc'],
      },
    });
    expect([
      ...api.createTrafficReservationLedgerFromTrips(reconciled.activeTrips).ownersByResource,
    ]).toEqual([
      ['IngressFootprint:home', 'drive-1'],
      ['IntersectionConflictZone:B:center', 'drive-1'],
      ['ReceivingAdmission:bc', 'drive-1'],
    ]);
  });

  it('atomically relocates an occupied invalid traversal before its deleted resources can become free', () => {
    const reconciled = api.reconcileTrafficReservationsAfterRoadMutation({
      snapshot: snapshot(occupiedTrip()),
      graph: graph([bd, dc], 2),
      destinationAccessNodeIdByTripId: new Map([['drive-1', 'C']]),
    });

    expect(reconciled.activeTrips[0]).toMatchObject({
      status: 'Active',
      driveMovementPhase: 'Travelling',
      routeEdgeIds: ['bd', 'dc'],
      lastStableNodeId: 'B',
      entryReservationResourceIds: [],
    });
    expect(reconciled.activeTrips[0]?.activeNodeTraversal).toBeUndefined();
    expect([
      ...api.createTrafficReservationLedgerFromTrips(reconciled.activeTrips).ownersByResource,
    ]).toEqual([]);
  });

  it('fails an invalid occupied traversal and clears every reservation in the same reconciliation', () => {
    const reconciled = api.reconcileTrafficReservationsAfterRoadMutation({
      snapshot: snapshot(occupiedTrip()),
      graph: graph([], 2),
      destinationAccessNodeIdByTripId: new Map([['drive-1', 'C']]),
    });

    expect(reconciled.activeTrips[0]).toMatchObject({
      status: 'Failed',
      failureReason: 'UnreachableDestination',
      driveMovementPhase: null,
      entryReservationResourceIds: [],
    });
    expect(reconciled.activeTrips[0]?.activeNodeTraversal).toBeUndefined();
    expect([
      ...api.createTrafficReservationLedgerFromTrips(reconciled.activeTrips).ownersByResource,
    ]).toEqual([]);
  });

  it('cancels an occupied traversal without leaving an orphan reservation owner', () => {
    const reconciled = api.reconcileTrafficReservationsAfterRoadMutation({
      snapshot: snapshot(occupiedTrip()),
      graph: graph([ab, bc], 2),
      destinationAccessNodeIdByTripId: new Map([['drive-1', 'C']]),
      cancelledTripIds: new Set(['drive-1']),
    });

    expect(reconciled.activeTrips[0]).toMatchObject({
      status: 'Cancelled',
      driveMovementPhase: null,
      entryReservationResourceIds: [],
    });
    expect(reconciled.activeTrips[0]?.activeNodeTraversal).toBeUndefined();
    expect([
      ...api.createTrafficReservationLedgerFromTrips(reconciled.activeTrips).ownersByResource,
    ]).toEqual([]);
  });
});
