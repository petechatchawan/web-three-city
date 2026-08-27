import { describe, expect, it } from 'vitest';
import * as trafficCore from '../src/index.js';
import type { ActiveTransportTripV2, TrafficGraph, TrafficSnapshotV2 } from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

type Candidate = Readonly<{
  tripId: string;
  nodeId: string;
  traversalClass: 'Merge' | 'ConflictJunction';
  incomingEdgeId: string;
  outgoingEdgeId: string;
  movementKind?: 'Straight' | 'Left' | 'Right';
  queuedAtTransportSecond: number;
  lanePositionQ: number;
  resourceIds: readonly string[];
}>;

type ArbitrationApi = Readonly<{
  createTrafficReservationLedger: (owners?: ReadonlyMap<string, string>) => unknown;
  trafficReservationOwnersByResource: (ledger: unknown) => ReadonlyMap<string, string>;
  arbitrateIntersectionMovements: (
    input: Readonly<{
      candidates: readonly Candidate[];
      ledger?: unknown;
      currentTransportSecond: number;
    }>,
  ) => Readonly<{
    grantedTripIds: readonly string[];
    waitingTripIds: readonly string[];
    ledger: unknown;
  }>;
  advanceTrafficQuantum: (
    input: Readonly<{
      snapshot: TrafficSnapshotV2;
      graph: TrafficGraph;
    }>,
  ) => Readonly<{ snapshot: TrafficSnapshotV2 }>;
}>;

const api = trafficCore as unknown as ArbitrationApi;

function candidate(tripId: string, overrides: Partial<Candidate> = {}): Candidate {
  return Object.freeze({
    tripId,
    nodeId: 'junction',
    traversalClass: 'ConflictJunction' as const,
    incomingEdgeId: `in-${tripId}`,
    outgoingEdgeId: `out-${tripId}`,
    movementKind: 'Straight' as const,
    queuedAtTransportSecond: 100,
    lanePositionQ: 900_000,
    resourceIds: Object.freeze([`IntersectionConflictZone:junction:zone-${tripId}`]),
    ...overrides,
  });
}

function graph(): TrafficGraph {
  const edges: readonly (readonly [string, string, string])[] = [
    ['ab', 'A', 'junction'],
    ['jb', 'junction', 'B'],
    ['cj', 'C', 'junction'],
    ['jd', 'junction', 'D'],
  ];
  return Object.freeze({
    sourceRoadRevision: 1,
    sourceBuildingRevision: 1,
    nodes: Object.freeze([
      { nodeId: 'A', xQ: -8_000, yQ: 0, zQ: 0 },
      { nodeId: 'junction', xQ: 0, yQ: 0, zQ: 0 },
      { nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 },
      { nodeId: 'C', xQ: 0, yQ: 0, zQ: -8_000 },
      { nodeId: 'D', xQ: 0, yQ: 0, zQ: 8_000 },
    ]),
    edges: Object.freeze(
      edges.map(([edgeId, fromNodeId, toNodeId]) =>
        Object.freeze({
          edgeId,
          fromNodeId,
          toNodeId,
          mode: 'Drive' as const,
          lengthQ: 8_000,
          freeFlowTravelSeconds: 1,
          capacityUnits: 1,
        }),
      ),
    ),
  });
}

function travellingTrip(tripId: string): ActiveTransportTripV2 {
  return Object.freeze({
    tripId,
    citizenId: `citizen-${tripId}`,
    mode: 'Drive' as const,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    routeEdgeIds: Object.freeze(['ab', 'jb']),
    routeGraphRevision: 1,
    segmentIndex: 0,
    progressQ: 0,
    lastStableNodeId: 'A',
    queuedMovement: null,
    status: 'Active' as const,
    failureReason: null,
    driveMovementPhase: 'Travelling' as const,
  });
}

function snapshot(activeTrips: readonly ActiveTransportTripV2[]): TrafficSnapshotV2 {
  return Object.freeze({
    schemaVersion: 2,
    revision: 0,
    policyVersion: 1,
    graphSourceRoadRevision: 1,
    graphSourceBuildingRevision: 1,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: trafficCore.absoluteTransportSecond(1_920),
      temporalPolicyVersion: 1 as const,
    },
    activeTrips,
  });
}

describe('atomic intersection and merge arbitration', () => {
  it('never grants perpendicular conflicting straights overlapping conflict resources', () => {
    const result = api.arbitrateIntersectionMovements({
      currentTransportSecond: 101,
      candidates: [
        candidate('west-east', { resourceIds: ['IntersectionConflictZone:junction:center'] }),
        candidate('north-south', { resourceIds: ['IntersectionConflictZone:junction:center'] }),
      ],
    });

    expect(result.grantedTripIds).toEqual(['north-south']);
    expect(result.waitingTripIds).toEqual(['west-east']);
  });

  it('grants independent complete bundles together', () => {
    const result = api.arbitrateIntersectionMovements({
      currentTransportSecond: 101,
      candidates: [
        candidate('a', {
          resourceIds: ['IntersectionConflictZone:junction:north-east', 'ReceivingAdmission:out-a'],
        }),
        candidate('b', {
          resourceIds: ['IntersectionConflictZone:junction:south-west', 'ReceivingAdmission:out-b'],
        }),
      ],
    });

    expect(result.grantedTripIds).toEqual(['a', 'b']);
    expect([...api.trafficReservationOwnersByResource(result.ledger)]).toEqual([
      ['IntersectionConflictZone:junction:north-east', 'a'],
      ['IntersectionConflictZone:junction:south-west', 'b'],
      ['ReceivingAdmission:out-a', 'a'],
      ['ReceivingAdmission:out-b', 'b'],
    ]);
  });

  it('serializes compatible movements racing for one outgoing receiving footprint', () => {
    const result = api.arbitrateIntersectionMovements({
      currentTransportSecond: 101,
      candidates: [
        candidate('a', {
          resourceIds: ['IntersectionConflictZone:junction:north-east', 'ReceivingAdmission:out'],
        }),
        candidate('b', {
          resourceIds: ['IntersectionConflictZone:junction:south-west', 'ReceivingAdmission:out'],
        }),
      ],
    });

    expect(result.grantedTripIds).toEqual(['a']);
    expect(result.waitingTripIds).toEqual(['b']);
  });

  it('acquires no part of a bundle when one resource is busy', () => {
    const result = api.arbitrateIntersectionMovements({
      currentTransportSecond: 101,
      ledger: api.createTrafficReservationLedger(new Map([['ReceivingAdmission:out', 'occupant']])),
      candidates: [
        candidate('candidate', {
          resourceIds: ['IntersectionConflictZone:junction:center', 'ReceivingAdmission:out'],
        }),
      ],
    });

    expect(result.grantedTripIds).toEqual([]);
    expect([...api.trafficReservationOwnersByResource(result.ledger)]).toEqual([
      ['ReceivingAdmission:out', 'occupant'],
    ]);
  });

  it('does not let a higher-priority rear vehicle overtake its front queued lane peer', () => {
    const result = api.arbitrateIntersectionMovements({
      currentTransportSecond: 101,
      candidates: [
        candidate('front-left', {
          incomingEdgeId: 'same-incoming',
          movementKind: 'Left',
          lanePositionQ: 950_000,
          resourceIds: ['IntersectionConflictZone:junction:center'],
        }),
        candidate('rear-straight', {
          incomingEdgeId: 'same-incoming',
          movementKind: 'Straight',
          lanePositionQ: 900_000,
          resourceIds: ['IntersectionConflictZone:junction:center'],
        }),
      ],
    });

    expect(result.grantedTripIds).toEqual(['front-left']);
    expect(result.waitingTripIds).toEqual(['rear-straight']);
  });

  it('promotes an aged left turn ahead of continuing straight demand with bounded integer age', () => {
    const result = api.arbitrateIntersectionMovements({
      currentTransportSecond: 160,
      candidates: [
        candidate('aged-left', {
          movementKind: 'Left',
          queuedAtTransportSecond: 100,
          resourceIds: ['IntersectionConflictZone:junction:center'],
        }),
        candidate('new-straight', {
          movementKind: 'Straight',
          queuedAtTransportSecond: 159,
          resourceIds: ['IntersectionConflictZone:junction:center'],
        }),
      ],
    });

    expect(result.grantedTripIds).toEqual(['aged-left']);
  });

  it('serializes merge and receiving resources with no elapsed-time release', () => {
    const first = api.arbitrateIntersectionMovements({
      currentTransportSecond: 101,
      candidates: [
        candidate('a', {
          traversalClass: 'Merge',
          resourceIds: ['MergeAdmission:junction', 'ReceivingAdmission:out'],
        }),
        candidate('b', {
          traversalClass: 'Merge',
          resourceIds: ['MergeAdmission:junction', 'ReceivingAdmission:out'],
        }),
      ],
    });
    const later = api.arbitrateIntersectionMovements({
      currentTransportSecond: 100_000,
      ledger: first.ledger,
      candidates: [
        candidate('b', {
          traversalClass: 'Merge',
          resourceIds: ['MergeAdmission:junction', 'ReceivingAdmission:out'],
        }),
      ],
    });

    expect(first.grantedTripIds).toEqual(['a']);
    expect(later.grantedTripIds).toEqual([]);
  });

  it('defers a newly queued movement until the next quantum and persists its granted traversal', () => {
    const first = api.advanceTrafficQuantum({
      snapshot: snapshot([travellingTrip('queued')]),
      graph: graph(),
    });
    const second = api.advanceTrafficQuantum({ snapshot: first.snapshot, graph: graph() });

    expect(first.snapshot.activeTrips[0]?.queuedMovement).not.toBeNull();
    expect(
      (first.snapshot.activeTrips[0] as ActiveTransportTripV2 & { activeNodeTraversal?: unknown })
        .activeNodeTraversal,
    ).toBeUndefined();
    expect(second.snapshot.activeTrips[0]?.queuedMovement).toBeNull();
    expect(
      (
        second.snapshot.activeTrips[0] as ActiveTransportTripV2 & {
          activeNodeTraversal?: { reservedResourceIds: readonly string[] };
        }
      ).activeNodeTraversal?.reservedResourceIds.length,
    ).toBeGreaterThan(0);
  });
});
