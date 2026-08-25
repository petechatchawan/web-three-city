import { describe, expect, it } from 'vitest';
import {
  advanceTrafficSnapshot,
  applyRouteRecovery,
  compareTrafficId,
  createActiveTransportTrip,
  createEmptyTrafficSnapshot,
  createTrafficEdgeProjections,
  createTrafficSnapshot,
  projectTrafficEdgeFlow,
  decodeTrafficSaveV1,
  encodeTrafficSaveV1,
  fingerprintTrafficSnapshot,
  planTransportRoute,
  recoverInvalidatedRoute,
  serviceIntersectionQueues,
  type ActiveTransportTrip,
  type TrafficGraph,
} from '../src/index.js';

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
      freeFlowTravelSeconds: 10,
      capacityUnits: 2,
    },
    {
      edgeId: 'bc',
      fromNodeId: 'B',
      toNodeId: 'C',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 2,
    },
    {
      edgeId: 'nb',
      fromNodeId: 'N',
      toNodeId: 'B',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 2,
    },
    {
      edgeId: 'bs',
      fromNodeId: 'B',
      toNodeId: 'S',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 2,
    },
  ]),
});

function trip(id: string): ActiveTransportTrip {
  const route = planTransportRoute(graph, {
    requestTripId: id,
    citizenId: `citizen-${id}`,
    mode: 'Drive',
    originAccessNodeId: 'A',
    destinationAccessNodeId: 'C',
  });
  return createActiveTransportTrip({
    tripId: id,
    citizenId: `citizen-${id}`,
    originBuildingId: 'home',
    destinationBuildingId: 'work',
    route,
    graph,
    routeGraphRevision: 1,
  });
}

describe('Traffic flow and persistence', () => {
  it('matches the per-edge reference projection exactly for mixed active and queued state', () => {
    const queued = Object.freeze({
      ...trip('queued'),
      queuedMovement: Object.freeze({
        fromEdgeId: 'ab',
        toEdgeId: 'bc',
        arrivedAtGameSecond: 100,
      }),
    });
    const terminal = Object.freeze({
      ...trip('terminal'),
      status: 'Arrived' as const,
    });
    const trips = Object.freeze([trip('active-b'), terminal, queued, trip('active-a')]);
    const expected = Object.freeze(
      graph.edges
        .map((edge) => projectTrafficEdgeFlow(edge, trips))
        .sort((first, second) => compareTrafficId(first.edgeId, second.edgeId)),
    );

    expect(createTrafficEdgeProjections({ graph, trips })).toEqual(expected);
  });

  it('does not advance committed Traffic revision while no trips are active', () => {
    const snapshot = createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 });
    const result = advanceTrafficSnapshot({
      snapshot,
      graph,
      elapsedSeconds: 3_600,
      intervalStartGameSecond: 0,
    });

    expect(result.snapshot.revision).toBe(snapshot.revision);
    expect(result.snapshot.activeTrips).toEqual(snapshot.activeTrips);
    expect(result.receipt).toMatchObject({
      beforeRevision: snapshot.revision,
      afterRevision: snapshot.revision,
      elapsedSeconds: 3_600,
    });
  });

  it('adds monotonic congestion only after capacity is exceeded', () => {
    const one = createTrafficEdgeProjections({ graph, trips: [trip('t1')] }).find(
      (edge) => edge.edgeId === 'ab',
    )!;
    const two = createTrafficEdgeProjections({ graph, trips: [trip('t1'), trip('t2')] }).find(
      (edge) => edge.edgeId === 'ab',
    )!;
    const three = createTrafficEdgeProjections({
      graph,
      trips: [trip('t1'), trip('t2'), trip('t3')],
    }).find((edge) => edge.edgeId === 'ab')!;

    expect(one.effectiveTravelSeconds).toBe(10);
    expect(two.effectiveTravelSeconds).toBe(10);
    expect(three.effectiveTravelSeconds).toBeGreaterThan(two.effectiveTravelSeconds);
    expect(three.congestionMilli).toBeGreaterThan(0);
  });

  it('services queued intersection trips in stable arrival then trip order', () => {
    const queued = ['trip-b', 'trip-a'].map((tripId) =>
      Object.freeze({
        ...trip(tripId),
        segmentIndex: 0,
        progressQ: 1_000_000,
        lastStableNodeId: 'B',
        queuedMovement: Object.freeze({
          fromEdgeId: 'ab',
          toEdgeId: 'bc',
          arrivedAtGameSecond: 100,
        }),
      }),
    );
    const firstSlot = serviceIntersectionQueues({ trips: queued, graph, elapsedSeconds: 4 });
    expect(firstSlot.releasedTripIds).toEqual(['trip-a']);
    expect(firstSlot.waitingTripIds).toEqual(['trip-b']);
  });

  it('round-trips exact logical route/progress/queue state in TrafficSaveV1', () => {
    const queued = Object.freeze({
      ...trip('trip-1'),
      progressQ: 1_000_000,
      lastStableNodeId: 'B',
      queuedMovement: Object.freeze({
        fromEdgeId: 'ab',
        toEdgeId: 'bc',
        arrivedAtGameSecond: 1234,
      }),
    });
    const snapshot = createTrafficSnapshot({
      ...createEmptyTrafficSnapshot({ roadRevision: 1, buildingRevision: 1 }),
      revision: 7,
      activeTrips: [queued],
    });
    const decoded = decodeTrafficSaveV1(
      JSON.parse(JSON.stringify(encodeTrafficSaveV1(snapshot))) as unknown,
      graph,
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(fingerprintTrafficSnapshot(decoded.value)).toBe(fingerprintTrafficSnapshot(snapshot));
    expect(JSON.stringify(encodeTrafficSaveV1(snapshot))).not.toContain('mesh');
  });

  it('recovers a topology-invalidated route from lastStableNode to latest destination', () => {
    const active = trip('trip-1');
    const replacementGraph: TrafficGraph = Object.freeze({
      ...graph,
      sourceRoadRevision: 2,
      edges: Object.freeze([
        graph.edges.find((edge) => edge.edgeId === 'nb')!,
        graph.edges.find((edge) => edge.edgeId === 'bs')!,
        {
          edgeId: 'bn',
          fromNodeId: 'B',
          toNodeId: 'N',
          mode: 'Drive' as const,
          lengthQ: 8_000,
          freeFlowTravelSeconds: 10,
          capacityUnits: 2,
        },
        {
          edgeId: 'nc',
          fromNodeId: 'N',
          toNodeId: 'C',
          mode: 'Drive' as const,
          lengthQ: 12_000,
          freeFlowTravelSeconds: 15,
          capacityUnits: 2,
        },
      ]),
    });
    const current = Object.freeze({ ...active, lastStableNodeId: 'B' });
    const recovery = recoverInvalidatedRoute({
      trip: current,
      graph: replacementGraph,
      request: {
        tripId: current.tripId,
        lastStableNodeId: 'B',
        latestDestinationAccessNodeId: 'C',
      },
    });
    expect(recovery.status).toBe('recovered');
    const applied = applyRouteRecovery(current, recovery, 2);
    expect(applied.routeGraphRevision).toBe(2);
    expect(applied.routeEdgeIds).toEqual(['bn', 'nc']);
    expect(applied.status).toBe('Active');
  });

  it('fails recoverably when destination becomes unreachable', () => {
    const active = trip('trip-1');
    const recovery = recoverInvalidatedRoute({
      trip: active,
      graph,
      request: {
        tripId: active.tripId,
        lastStableNodeId: 'B',
        latestDestinationAccessNodeId: null,
      },
    });
    expect(applyRouteRecovery(active, recovery, 2)).toMatchObject({
      status: 'Failed',
      failureReason: 'UnreachableDestination',
    });
  });
});
