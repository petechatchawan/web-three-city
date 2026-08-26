import { describe, expect, it } from 'vitest';
import {
  advanceTrafficQuantum,
  createTrafficSnapshotV2,
  type ActiveTransportTripV2,
  type TrafficGraph,
  type TrafficSnapshotV2,
} from '../src/index.js';

type DriveLifecycleTrip = Omit<ActiveTransportTripV2, 'driveMovementPhase'> &
  Readonly<{
    driveMovementPhase?: 'WaitingForEntry' | 'Entering' | 'Travelling' | 'Leaving';
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
      capacityUnits: 2,
    },
  ]),
});

function driveTrip(overrides: Partial<Omit<DriveLifecycleTrip, 'mode'>> = {}): DriveLifecycleTrip {
  return Object.freeze({
    tripId: 'drive-1',
    citizenId: 'citizen-1',
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
    ...overrides,
  });
}

function snapshot(trip: DriveLifecycleTrip): TrafficSnapshotV2 {
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 0,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: 480,
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: 1_920,
      temporalPolicyVersion: 1,
    },
    activeTrips: [trip as unknown as ActiveTransportTripV2],
  });
}

describe('authoritative Drive lifecycle', () => {
  it('requires a new active Drive to begin WaitingForEntry', () => {
    expect((snapshot(driveTrip()).activeTrips[0] as DriveLifecycleTrip).driveMovementPhase).toBe(
      'WaitingForEntry',
    );
  });

  it('crosses only WaitingForEntry to Entering in one quantum', () => {
    const result = advanceTrafficQuantum({
      snapshot: snapshot(driveTrip({ driveMovementPhase: 'WaitingForEntry' })),
      graph,
    });

    expect(result.snapshot.activeTrips[0]).toMatchObject({
      driveMovementPhase: 'Entering',
      progressQ: 0,
      status: 'Active',
    });
  });

  it('moves a final-edge Drive into Leaving instead of Arrived', () => {
    const result = advanceTrafficQuantum({
      snapshot: snapshot(driveTrip({ driveMovementPhase: 'Travelling', progressQ: 875_000 })),
      graph,
    });

    expect(result.snapshot.activeTrips[0]).toMatchObject({
      driveMovementPhase: 'Leaving',
      progressQ: 1_000_000,
      status: 'Active',
    });
    expect(result.receipt.arrivedTripIds).toEqual([]);
  });

  it('rejects terminal Drive states that retain a movement phase', () => {
    expect(() =>
      snapshot(
        driveTrip({
          driveMovementPhase: 'Leaving',
          progressQ: 1_000_000,
          status: 'Arrived',
        }),
      ),
    ).toThrow('traffic:invalid-trip');
  });
});
