import { describe, expect, it } from 'vitest';
import * as trafficCore from '../src/index.js';
import type {
  ActiveTransportTrip,
  TrafficGraph,
  TrafficSnapshotV1,
  TrafficSnapshotV2,
} from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

type TrafficV2PersistenceApi = Readonly<{
  encodeTrafficSaveV2?: (snapshot: TrafficSnapshotV2) => unknown;
  decodeTrafficSaveV2?: (
    input: unknown,
    graph: TrafficGraph,
  ) =>
    | Readonly<{ ok: true; value: TrafficSnapshotV2 }>
    | Readonly<{ ok: false; error: Readonly<{ code: 'traffic-save:invalid' }> }>;
  migrateTrafficSaveV1ToV2?: (
    input: Readonly<{
      snapshot: TrafficSnapshotV1;
      graph: TrafficGraph;
      legacyCurrentGameSecond: number;
      timeCursor: TrafficSnapshotV2['timeCursor'];
    }>,
  ) => TrafficSnapshotV2;
}>;

const api = trafficCore as TrafficV2PersistenceApi;

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 1,
  sourceBuildingRevision: 1,
  nodes: Object.freeze([
    { nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 },
    { nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 },
    { nodeId: 'C', xQ: 16_000, yQ: 0, zQ: 0 },
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
      edgeId: 'bc',
      fromNodeId: 'B',
      toNodeId: 'C',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 8,
      capacityUnits: 1,
    },
  ]),
});

const cursor: TrafficSnapshotV2['timeCursor'] = Object.freeze({
  sourceGameMinute: absoluteGameMinute(480),
  completedTransportQuantaWithinMinute: 2,
  absoluteTransportSecond: trafficCore.absoluteTransportSecond(1_922),
  temporalPolicyVersion: 1,
});

function driveV2(
  overrides: Partial<TrafficSnapshotV2['activeTrips'][number]> = {},
): TrafficSnapshotV2['activeTrips'][number] {
  return Object.freeze({
    tripId: 'drive-1',
    citizenId: 'citizen-1',
    mode: 'Drive' as const,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['ab', 'bc']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 500_000,
    lastStableNodeId: 'A',
    queuedMovement: null,
    status: 'Active' as const,
    failureReason: null,
    driveMovementPhase: 'Travelling' as const,
    entryServiceCredit: 3,
    entryReservationResourceIds: Object.freeze(['IngressFootprint:home', 'ReceivingAdmission:ab']),
    activeNodeTraversal: Object.freeze({
      nodeId: 'B',
      traversalClass: 'ConflictJunction' as const,
      incomingEdgeId: 'ab',
      outgoingEdgeId: 'bc',
      movementKind: 'Straight' as const,
      reservedResourceIds: Object.freeze([
        'IntersectionConflictZone:B:center',
        'ReceivingAdmission:bc',
      ]),
      progressQ: 250_000,
    }),
    ...overrides,
  });
}

function queuedDriveV2(): TrafficSnapshotV2['activeTrips'][number] {
  const { activeNodeTraversal, ...trip } = driveV2();
  void activeNodeTraversal;
  return Object.freeze({
    ...trip,
    tripId: 'queued-drive',
    entryReservationResourceIds: Object.freeze([]),
    progressQ: 1_000_000,
    lastStableNodeId: 'B',
    queuedMovement: Object.freeze({
      fromEdgeId: 'ab',
      toEdgeId: 'bc',
      arrivedAtTransportSecond: trafficCore.absoluteTransportSecond(1_919),
    }),
  });
}

function v2Snapshot(activeTrips = [driveV2()]): TrafficSnapshotV2 {
  return Object.freeze({
    schemaVersion: 2,
    revision: 7,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: cursor,
    activeTrips: Object.freeze(activeTrips),
  });
}

function driveV1(overrides: Partial<ActiveTransportTrip> = {}): ActiveTransportTrip {
  return Object.freeze({
    tripId: 'legacy-drive',
    citizenId: 'citizen-legacy',
    mode: 'Drive' as const,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['ab', 'bc']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 500_000,
    lastStableNodeId: 'A',
    queuedMovement: null,
    status: 'Active' as const,
    failureReason: null,
    ...overrides,
  });
}

function v1Snapshot(activeTrips: readonly ActiveTransportTrip[]): TrafficSnapshotV1 {
  return Object.freeze({
    schemaVersion: 1,
    revision: 4,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    activeTrips: Object.freeze(activeTrips),
  });
}

describe('TrafficSaveV2 migration', () => {
  it('reuses an already canonical immutable V2 snapshot', () => {
    const snapshot = trafficCore.createTrafficSnapshotV2(v2Snapshot());

    expect(trafficCore.createTrafficSnapshotV2(snapshot)).toBe(snapshot);
  });

  it('round-trips exact authoritative cursor, phase, progress, access, queue, traversal, and reservation facts', () => {
    expect(typeof api.encodeTrafficSaveV2).toBe('function');
    expect(typeof api.decodeTrafficSaveV2).toBe('function');
    const snapshot = v2Snapshot([driveV2(), queuedDriveV2()]);
    const decoded = api.decodeTrafficSaveV2!(
      JSON.parse(JSON.stringify(api.encodeTrafficSaveV2!(snapshot))),
      graph,
    );
    expect(decoded).toEqual({ ok: true, value: snapshot });
    expect(JSON.stringify(api.encodeTrafficSaveV2!(snapshot))).not.toMatch(
      /lane|leader|cache|ownersByResource/,
    );
  });

  it('rebases legacy queue timestamps by age without numerically reinterpreting old game seconds', () => {
    expect(typeof api.migrateTrafficSaveV1ToV2).toBe('function');
    const migrated = api.migrateTrafficSaveV1ToV2!({
      snapshot: v1Snapshot([
        driveV1({
          tripId: 'older',
          queuedMovement: Object.freeze({
            fromEdgeId: 'ab',
            toEdgeId: 'bc',
            arrivedAtGameSecond: 990,
          }),
        }),
        driveV1({
          tripId: 'newer',
          queuedMovement: Object.freeze({
            fromEdgeId: 'ab',
            toEdgeId: 'bc',
            arrivedAtGameSecond: 998,
          }),
        }),
      ]),
      graph,
      legacyCurrentGameSecond: 1_000,
      timeCursor: cursor,
    });
    expect(
      migrated.activeTrips.map((trip) => [
        trip.tripId,
        trip.queuedMovement?.arrivedAtTransportSecond,
      ]),
    ).toEqual([
      ['newer', 1_920],
      ['older', 1_912],
    ]);
  });

  it('normalizes V1 overlap only by rewinding followers and returns route-origin overflow to WaitingForEntry', () => {
    expect(typeof api.migrateTrafficSaveV1ToV2).toBe('function');
    const migrated = api.migrateTrafficSaveV1ToV2!({
      snapshot: v1Snapshot([
        driveV1({ tripId: 'leader', progressQ: 200_000 }),
        driveV1({ tripId: 'follower', progressQ: 150_000 }),
        driveV1({ tripId: 'overflow', progressQ: 100_000 }),
      ]),
      graph,
      legacyCurrentGameSecond: 1_000,
      timeCursor: cursor,
    });
    expect(migrated.activeTrips).toMatchObject([
      { tripId: 'follower', driveMovementPhase: 'Travelling', progressQ: 75_000 },
      { tripId: 'leader', driveMovementPhase: 'Travelling', progressQ: 200_000 },
      {
        tripId: 'overflow',
        driveMovementPhase: 'WaitingForEntry',
        segmentIndex: 0,
        progressQ: 0,
        queuedMovement: null,
      },
    ]);
  });

  it('rejects current V2 overlap rather than normalizing it', () => {
    expect(typeof api.decodeTrafficSaveV2).toBe('function');
    const save = v2Snapshot([
      driveV2({ tripId: 'leader', progressQ: 200_000 }),
      driveV2({ tripId: 'follower', progressQ: 150_000 }),
    ]);
    expect(api.decodeTrafficSaveV2!(JSON.parse(JSON.stringify(save)), graph)).toEqual({
      ok: false,
      error: { code: 'traffic-save:invalid' },
    });
  });
});
