import { describe, expect, it } from 'vitest';
import {
  TrafficRouteCache,
  advanceTrafficSnapshot,
  createTrafficProjection,
  createTrafficSnapshot,
  fingerprintTrafficSnapshot,
  planTransportRoute,
  type ActiveTransportTrip,
  type TrafficGraph,
} from '../src/index.js';

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 7,
  sourceBuildingRevision: 3,
  nodes: Object.freeze([
    Object.freeze({ nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 }),
    Object.freeze({ nodeId: 'B', xQ: 8_000, yQ: 0, zQ: 0 }),
  ]),
  edges: Object.freeze([
    Object.freeze({
      edgeId: 'walk-ab',
      fromNodeId: 'A',
      toNodeId: 'B',
      mode: 'Walk' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 6,
      capacityUnits: 1_000,
    }),
    Object.freeze({
      edgeId: 'drive-ab',
      fromNodeId: 'A',
      toNodeId: 'B',
      mode: 'Drive' as const,
      lengthQ: 8_000,
      freeFlowTravelSeconds: 2,
      capacityUnits: 1_000,
    }),
  ]),
});

function snapshot() {
  const trips: ActiveTransportTrip[] = Array.from({ length: 5_000 }, (_, index) => {
    const mode = index % 2 === 0 ? ('Walk' as const) : ('Drive' as const);
    return Object.freeze({
      tripId: `trip-${String(index).padStart(5, '0')}`,
      citizenId: `citizen-${String(index).padStart(5, '0')}`,
      mode,
      originBuildingId: `home-${index % 250}`,
      destinationBuildingId: `work-${index % 100}`,
      routeEdgeIds: Object.freeze([mode === 'Walk' ? 'walk-ab' : 'drive-ab']),
      routeGraphRevision: graph.sourceRoadRevision,
      segmentIndex: 0,
      progressQ: index % 100_000,
      lastStableNodeId: 'A',
      queuedMovement: null,
      status: 'Active' as const,
      failureReason: null,
    });
  });
  return createTrafficSnapshot({
    schemaVersion: 1,
    revision: 1,
    policyVersion: 1,
    graphSourceRoadRevision: graph.sourceRoadRevision,
    graphSourceBuildingRevision: graph.sourceBuildingRevision,
    activeTrips: trips,
  });
}

describe('Traffic release scale gate', () => {
  it('progresses and projects 5,000 mixed trips deterministically', () => {
    const first = advanceTrafficSnapshot({
      snapshot: snapshot(),
      graph,
      elapsedSeconds: 1,
      intervalStartGameSecond: 100,
    });
    const second = advanceTrafficSnapshot({
      snapshot: snapshot(),
      graph,
      elapsedSeconds: 1,
      intervalStartGameSecond: 100,
    });
    expect(fingerprintTrafficSnapshot(first.snapshot)).toBe(
      fingerprintTrafficSnapshot(second.snapshot),
    );
    expect(first.snapshot.activeTrips).toHaveLength(5_000);

    const firstProjection = createTrafficProjection({ snapshot: first.snapshot, graph });
    const secondProjection = createTrafficProjection({ snapshot: second.snapshot, graph });
    expect(firstProjection.edges).toEqual(secondProjection.edges);
    expect([...firstProjection.nextCostField.edgeTravelSecondsById.entries()]).toEqual([
      ...secondProjection.nextCostField.edgeTravelSecondsById.entries(),
    ]);
    expect([...firstProjection.nextCostField.queueDelaySecondsByNodeId.entries()]).toEqual([
      ...secondProjection.nextCostField.queueDelaySecondsByNodeId.entries(),
    ]);
  });

  it('keeps cached and uncached canonical route outputs equal', () => {
    const request = Object.freeze({
      requestTripId: 'trip-cache',
      citizenId: 'citizen-cache',
      mode: 'Drive' as const,
      originAccessNodeId: 'A',
      destinationAccessNodeId: 'B',
    });
    const uncached = planTransportRoute(graph, request);
    const cache = new TrafficRouteCache();
    const key = Object.freeze({
      mode: 'Drive' as const,
      originAccessNodeId: 'A',
      destinationAccessNodeId: 'B',
      roadGraphRevision: graph.sourceRoadRevision,
      trafficCostRevision: 0,
      routingPolicyVersion: 1 as const,
    });
    const cached = cache.getOrCreate(key, () => planTransportRoute(graph, request));
    expect(cached).toEqual(uncached);
    expect(
      cache.getOrCreate(key, () => {
        throw new Error('route cache should reuse canonical output');
      }),
    ).toEqual(uncached);
  });
});
