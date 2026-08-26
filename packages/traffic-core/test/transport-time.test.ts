import { describe, expect, it } from 'vitest';
import * as trafficCore from '../src/index.js';
import type { ActiveTransportTrip, TrafficGraph } from '../src/index.js';

interface TrafficTimeCursor {
  readonly sourceGameMinute: number;
  readonly completedTransportQuantaWithinMinute: number;
  readonly absoluteTransportSecond: number;
  readonly temporalPolicyVersion: number;
}

interface TrafficSnapshotV2 {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly graphSourceRoadRevision: number;
  readonly graphSourceBuildingRevision: number;
  readonly timeCursor: TrafficTimeCursor;
  readonly activeTrips: readonly ActiveTransportTrip[];
}

interface TrafficQuantumReceipt {
  readonly elapsedTransportSeconds: 1;
  readonly newlyQueuedTripIds: readonly string[];
}

type TrafficV2Api = Readonly<{
  createTrafficSnapshotV2: (input: TrafficSnapshotV2) => TrafficSnapshotV2;
  advanceTrafficQuantum: (
    input: Readonly<{
      snapshot: TrafficSnapshotV2;
      graph: TrafficGraph;
    }>,
  ) => Readonly<{ snapshot: TrafficSnapshotV2; receipt: TrafficQuantumReceipt }>;
}>;

const api = trafficCore as unknown as TrafficV2Api;

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 1,
  sourceBuildingRevision: 1,
  nodes: Object.freeze([
    { nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 },
    { nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 },
    { nodeId: 'C', xQ: 16_000, yQ: 0, zQ: 0 },
    { nodeId: 'N', xQ: 8_000, yQ: 0, zQ: -8_000 },
    { nodeId: 'S', xQ: 8_000, yQ: 0, zQ: 8_000 },
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
    {
      edgeId: 'bc',
      fromNodeId: 'B',
      toNodeId: 'C',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 8,
      capacityUnits: 2,
    },
    {
      edgeId: 'nb',
      fromNodeId: 'N',
      toNodeId: 'B',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 8,
      capacityUnits: 2,
    },
    {
      edgeId: 'bs',
      fromNodeId: 'B',
      toNodeId: 'S',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 8,
      capacityUnits: 2,
    },
  ]),
});

type TravellingDriveTrip = ActiveTransportTrip & Readonly<{ driveMovementPhase: 'Travelling' }>;

function activeTrip(overrides: Partial<TravellingDriveTrip> = {}): TravellingDriveTrip {
  return Object.freeze({
    tripId: 'trip-1',
    citizenId: 'citizen-1',
    mode: 'Drive',
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['ab', 'bc']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 0,
    lastStableNodeId: 'A',
    queuedMovement: null,
    status: 'Active',
    failureReason: null,
    driveMovementPhase: 'Travelling',
    ...overrides,
  });
}

function snapshot(activeTrips: readonly ActiveTransportTrip[] = [activeTrip()]): TrafficSnapshotV2 {
  return api.createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 7,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: 480,
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: 1_920,
      temporalPolicyVersion: 1,
    },
    activeTrips,
  });
}

describe('Traffic transport time', () => {
  it('advances an empty transport quantum without requiring graph metadata', () => {
    const result = api.advanceTrafficQuantum({
      snapshot: snapshot([]),
      graph: Object.freeze({}) as unknown as TrafficGraph,
    });

    expect(result.snapshot.revision).toBe(8);
    expect(result.snapshot.timeCursor.absoluteTransportSecond).toBe(1_921);
    expect(result.receipt).toMatchObject({
      elapsedTransportSeconds: 1,
      newlyQueuedTripIds: [],
    });
  });

  it('advances exactly one transport second per quantum', () => {
    let current = snapshot();
    for (let index = 0; index < 4; index += 1) {
      current = api.advanceTrafficQuantum({ snapshot: current, graph }).snapshot;
    }

    expect(current.timeCursor).toEqual({
      sourceGameMinute: 480,
      completedTransportQuantaWithinMinute: 4,
      absoluteTransportSecond: 1_924,
      temporalPolicyVersion: 1,
    });
    expect(current.activeTrips[0]).toMatchObject({
      segmentIndex: 0,
      progressQ: 500_000,
      queuedMovement: null,
      status: 'Active',
    });
  });

  it('records a new intersection queue arrival in transport seconds without releasing it', () => {
    const result = api.advanceTrafficQuantum({
      snapshot: snapshot([activeTrip({ progressQ: 875_000 })]),
      graph,
    });

    expect(result.receipt).toMatchObject({
      elapsedTransportSeconds: 1,
      newlyQueuedTripIds: ['trip-1'],
    });
    expect(result.snapshot.activeTrips[0]?.queuedMovement).toEqual({
      fromEdgeId: 'ab',
      toEdgeId: 'bc',
      arrivedAtTransportSecond: 1_921,
    });
  });

  it('rejects a cursor that skips the active minute policy or advances beyond its fourth quantum', () => {
    expect(() =>
      api.createTrafficSnapshotV2({
        ...snapshot(),
        timeCursor: {
          sourceGameMinute: 480,
          completedTransportQuantaWithinMinute: 1,
          absoluteTransportSecond: 1_925,
          temporalPolicyVersion: 1,
        },
      }),
    ).toThrow('traffic:invalid-state');

    let completedMinute = snapshot([]);
    for (let index = 0; index < 4; index += 1) {
      completedMinute = api.advanceTrafficQuantum({ snapshot: completedMinute, graph }).snapshot;
    }
    expect(() => api.advanceTrafficQuantum({ snapshot: completedMinute, graph })).toThrow(
      'traffic:invalid-state',
    );
  });
});
