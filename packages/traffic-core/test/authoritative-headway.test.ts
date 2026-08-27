import { describe, expect, it } from 'vitest';
import {
  advanceTrafficQuantum,
  absoluteTransportSecond,
  createTrafficSnapshotV2,
  type ActiveTransportTripV2,
  type TrafficGraph,
  type TrafficSnapshotV2,
} from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

const POSITION_Q_PER_EDGE = 1_000_000;

function graphFor(
  edges: readonly Readonly<{ edgeId: string; from: string; to: string }>[],
): TrafficGraph {
  const nodeIds = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))].sort();
  return Object.freeze({
    sourceRoadRevision: 1,
    sourceBuildingRevision: 1,
    nodes: Object.freeze(
      nodeIds.map((nodeId, index) => ({ nodeId, xQ: index * 8_000, yQ: 0, zQ: 0 })),
    ),
    edges: Object.freeze(
      edges.map((edge) =>
        Object.freeze({
          edgeId: edge.edgeId,
          fromNodeId: edge.from,
          toNodeId: edge.to,
          mode: 'Drive' as const,
          lengthQ: 8_000,
          freeFlowTravelSeconds: 16,
          capacityUnits: 2,
        }),
      ),
    ),
  });
}

function travellingDrive(
  tripId: string,
  routeEdgeIds: readonly string[],
  segmentIndex: number,
  progressQ: number,
  queuedMovement: ActiveTransportTripV2['queuedMovement'] = null,
): ActiveTransportTripV2 {
  return Object.freeze({
    tripId,
    citizenId: `citizen-${tripId}`,
    mode: 'Drive' as const,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze([...routeEdgeIds]),
    routeGraphRevision: 1,
    segmentIndex,
    progressQ,
    lastStableNodeId: 'A',
    queuedMovement,
    status: 'Active' as const,
    failureReason: null,
    driveMovementPhase: 'Travelling' as const,
  });
}

function snapshot(activeTrips: readonly ActiveTransportTripV2[]): TrafficSnapshotV2 {
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 0,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: absoluteTransportSecond(1_920),
      temporalPolicyVersion: 1,
    },
    activeTrips,
  });
}

function progressFor(result: ReturnType<typeof advanceTrafficQuantum>, tripId: string): number {
  return result.snapshot.activeTrips.find((trip) => trip.tripId === tripId)!.progressQ;
}

describe('authoritative Drive headway', () => {
  it('caps a same-edge follower at the canonical front-to-front headway behind a stopped leader', () => {
    const graph = graphFor([{ edgeId: 'ab', from: 'A', to: 'B' }]);
    const result = advanceTrafficQuantum({
      snapshot: snapshot([
        travellingDrive('leader', ['ab'], 0, 900_000, {
          fromEdgeId: 'ab',
          toEdgeId: 'ab',
          arrivedAtTransportSecond: absoluteTransportSecond(1_900),
        }),
        travellingDrive('follower', ['ab'], 0, 100_000),
      ]),
      graph,
    });

    expect(progressFor(result, 'follower')).toBe(125_000);
  });

  it('uses a downstream leader on the same lane span across an edge boundary', () => {
    const graph = graphFor([
      { edgeId: 'ab', from: 'A', to: 'B' },
      { edgeId: 'bc', from: 'B', to: 'C' },
      { edgeId: 'cd', from: 'C', to: 'D' },
    ]);
    const result = advanceTrafficQuantum({
      snapshot: snapshot([
        travellingDrive('leader', ['ab', 'bc', 'cd'], 1, 100_000, {
          fromEdgeId: 'bc',
          toEdgeId: 'cd',
          arrivedAtTransportSecond: absoluteTransportSecond(1_900),
        }),
        travellingDrive('follower', ['ab', 'bc', 'cd'], 0, 200_000),
      ]),
      graph,
    });

    expect(progressFor(result, 'follower')).toBe(200_000);
  });

  it('keeps headway through a bend without relying on edge identity', () => {
    const graph = graphFor([
      { edgeId: 'ab', from: 'A', to: 'B' },
      { edgeId: 'bc-bend', from: 'B', to: 'C' },
      { edgeId: 'cd', from: 'C', to: 'D' },
    ]);
    const result = advanceTrafficQuantum({
      snapshot: snapshot([
        travellingDrive('leader', ['ab', 'bc-bend', 'cd'], 1, 100_000, {
          fromEdgeId: 'bc-bend',
          toEdgeId: 'cd',
          arrivedAtTransportSecond: absoluteTransportSecond(1_900),
        }),
        travellingDrive('follower', ['ab', 'bc-bend', 'cd'], 0, 200_000),
      ]),
      graph,
    });

    expect(progressFor(result, 'follower')).toBe(200_000);
  });

  it('keeps diverging routes constrained while their vehicles share the upstream lane span', () => {
    const graph = graphFor([
      { edgeId: 'ab', from: 'A', to: 'B' },
      { edgeId: 'bc', from: 'B', to: 'C' },
      { edgeId: 'bd', from: 'B', to: 'D' },
    ]);
    const result = advanceTrafficQuantum({
      snapshot: snapshot([
        travellingDrive('leader', ['ab', 'bc'], 0, 900_000, {
          fromEdgeId: 'ab',
          toEdgeId: 'bc',
          arrivedAtTransportSecond: absoluteTransportSecond(1_900),
        }),
        travellingDrive('follower', ['ab', 'bd'], 0, 100_000),
      ]),
      graph,
    });

    expect(progressFor(result, 'follower')).toBe(125_000);
  });

  it('derives required headway from immutable free-flow design speed rather than congestion projection', async () => {
    const api = (await import('../src/index.js')) as unknown as Readonly<{
      requiredVehicleFrontHeadwayMillimeters: (
        input: Readonly<{
          freeFlowSpeedMillimetersPerSecond: number;
          congestionMilli: number;
        }>,
      ) => number;
    }>;

    expect(
      api.requiredVehicleFrontHeadwayMillimeters({
        freeFlowSpeedMillimetersPerSecond: 8_333,
        congestionMilli: 0,
      }),
    ).toBe(
      api.requiredVehicleFrontHeadwayMillimeters({
        freeFlowSpeedMillimetersPerSecond: 8_333,
        congestionMilli: 4_000,
      }),
    );
  });

  it('builds canonical occupancy from Traffic state without materialization input', async () => {
    const api = (await import('../src/index.js')) as unknown as Readonly<{
      createLaneOccupancyIndex: (
        input: Readonly<{
          graph: TrafficGraph;
          trips: readonly ActiveTransportTripV2[];
        }>,
      ) => Readonly<{ laneSpanCount: number }>;
    }>;
    const graph = graphFor([{ edgeId: 'ab', from: 'A', to: 'B' }]);

    expect(
      api.createLaneOccupancyIndex({
        graph,
        trips: [travellingDrive('drive-1', ['ab'], 0, POSITION_Q_PER_EDGE / 2)],
      }),
    ).toEqual({ laneSpanCount: 1 });
  });
});
