import { describe, expect, it } from 'vitest';
import {
  deriveTrafficCostField,
  planTransportRoute,
  TrafficRouteCache,
  type TrafficGraph,
} from '../src/index.js';

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 7,
  sourceBuildingRevision: 4,
  nodes: Object.freeze([
    { nodeId: 'A', xQ: 0, yQ: 0, zQ: 0 },
    { nodeId: 'B', xQ: 1_000, yQ: 0, zQ: 0 },
    { nodeId: 'C', xQ: 0, yQ: 0, zQ: 1_000 },
    { nodeId: 'D', xQ: 1_000, yQ: 0, zQ: 1_000 },
  ]),
  edges: Object.freeze([
    {
      edgeId: 'ab',
      fromNodeId: 'A',
      toNodeId: 'B',
      mode: 'Drive' as const,
      lengthQ: 1000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 10,
    },
    {
      edgeId: 'bd',
      fromNodeId: 'B',
      toNodeId: 'D',
      mode: 'Drive' as const,
      lengthQ: 1000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 10,
    },
    {
      edgeId: 'ac',
      fromNodeId: 'A',
      toNodeId: 'C',
      mode: 'Drive' as const,
      lengthQ: 1000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 10,
    },
    {
      edgeId: 'cd',
      fromNodeId: 'C',
      toNodeId: 'D',
      mode: 'Drive' as const,
      lengthQ: 1000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 10,
    },
  ]),
});

const request = Object.freeze({
  requestTripId: 'mobility-trip-0000000001',
  citizenId: 'citizen-1',
  mode: 'Drive' as const,
  originAccessNodeId: 'A',
  destinationAccessNodeId: 'D',
});

describe('Traffic routing', () => {
  it('uses explicit stable tie-breaking for equal-cost routes', () => {
    const route = planTransportRoute(graph, request);
    expect(route.available).toBe(true);
    expect(route.generalizedCostSeconds).toBe(20);
    expect(route.routeEdgeIds).toEqual(['ab', 'bd']);
  });

  it('uses the caller supplied previous committed cost field for Drive routing', () => {
    const previousCost = deriveTrafficCostField({
      trafficRevision: 9,
      edges: [
        { edgeId: 'ab', effectiveTravelSeconds: 40 },
        { edgeId: 'bd', effectiveTravelSeconds: 40 },
        { edgeId: 'ac', effectiveTravelSeconds: 10 },
        { edgeId: 'cd', effectiveTravelSeconds: 10 },
      ],
    });
    const route = planTransportRoute(graph, request, previousCost);
    expect(route.routeEdgeIds).toEqual(['ac', 'cd']);
    expect(route.generalizedCostSeconds).toBe(20);
  });

  it('fails closed for unreachable endpoints', () => {
    const route = planTransportRoute(graph, { ...request, destinationAccessNodeId: 'missing' });
    expect(route).toEqual({
      requestTripId: request.requestTripId,
      mode: 'Drive',
      available: false,
      generalizedCostSeconds: null,
      routeEdgeIds: [],
    });
  });

  it('keys disposable route cache by graph/cost revisions', () => {
    const cache = new TrafficRouteCache();
    let calls = 0;
    const key = {
      mode: 'Drive' as const,
      originAccessNodeId: 'A',
      destinationAccessNodeId: 'D',
      roadGraphRevision: 7,
      trafficCostRevision: 9,
      routingPolicyVersion: 1 as const,
    };
    const first = cache.getOrCreate(key, () => {
      calls += 1;
      return planTransportRoute(graph, request);
    });
    const second = cache.getOrCreate(key, () => {
      calls += 1;
      return planTransportRoute(graph, request);
    });
    expect(first).toEqual(second);
    expect(calls).toBe(1);
    expect(cache.get({ ...key, trafficCostRevision: 10 })).toBeNull();
  });
});
