import { describe, expect, it } from 'vitest';
import {
  addTransportSeconds,
  advanceTrafficQuantum,
  createTrafficSnapshotV2,
  transportSecondAtGameMinute,
  transportSecondDuration,
  transportSecondValue,
  type ActiveTransportTripV2,
  type TrafficGraph,
  type TrafficSnapshotV2,
} from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

const emptyGraph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 1,
  sourceBuildingRevision: 1,
  nodes: Object.freeze([]),
  edges: Object.freeze([]),
});

const walkingGraph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 1,
  sourceBuildingRevision: 1,
  nodes: Object.freeze([
    { nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 },
    { nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 },
  ]),
  edges: Object.freeze([
    {
      edgeId: 'walk-ab',
      fromNodeId: 'A',
      toNodeId: 'B',
      mode: 'Walk' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 1,
      capacityUnits: 1,
    },
  ]),
});

function snapshot(
  sourceGameMinute: number,
  activeTrips: readonly ActiveTransportTripV2[] = [],
): TrafficSnapshotV2 {
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 0,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(sourceGameMinute),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: transportSecondAtGameMinute(absoluteGameMinute(sourceGameMinute)),
      temporalPolicyVersion: 1,
    },
    activeTrips,
  });
}

function walkingTrip(): ActiveTransportTripV2 {
  return Object.freeze({
    tripId: 'walk-trip',
    citizenId: 'citizen-walk',
    mode: 'Walk' as const,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['walk-ab']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 0,
    lastStableNodeId: 'A',
    queuedMovement: null,
    status: 'Active' as const,
    failureReason: null,
    driveMovementPhase: null,
  });
}

describe('Traffic transport-time characterization', () => {
  it.each([0, 1, 37])(
    'advances source GameMinute %s through exactly four one-second quanta',
    (sourceGameMinute) => {
      let current = snapshot(sourceGameMinute);

      for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
        current = advanceTrafficQuantum({ snapshot: current, graph: emptyGraph }).snapshot;
        expect(current.timeCursor).toEqual({
          sourceGameMinute,
          completedTransportQuantaWithinMinute: ordinal,
          absoluteTransportSecond: transportSecondValue(
            addTransportSeconds(
              transportSecondAtGameMinute(absoluteGameMinute(sourceGameMinute)),
              transportSecondDuration(ordinal),
            ),
          ),
          temporalPolicyVersion: 1,
        });
      }

      expect(current.revision).toBe(4);
    },
  );

  it('preserves a walking trip until its terminal transport quantum', () => {
    const result = advanceTrafficQuantum({
      snapshot: snapshot(1, [walkingTrip()]),
      graph: walkingGraph,
    });

    expect(result.receipt.arrivedTripIds).toEqual(['walk-trip']);
    expect(result.snapshot.activeTrips[0]).toMatchObject({
      tripId: 'walk-trip',
      mode: 'Walk',
      progressQ: 1_000_000,
      status: 'Arrived',
    });
  });
});
