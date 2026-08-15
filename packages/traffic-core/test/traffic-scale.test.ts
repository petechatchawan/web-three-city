import { describe, expect, it } from 'vitest';
import {
  createTrafficEdgeProjections,
  createTrafficSnapshot,
  type ActiveTransportTrip,
  type TrafficGraph,
} from '../src/index.js';

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
      mode: 'Drive',
      lengthQ: 8_000,
      freeFlowTravelSeconds: 10,
      capacityUnits: 100,
    },
  ]),
});

describe('Traffic production scale', () => {
  it('stores and projects 5,000 logical trips without render state', () => {
    const trips: ActiveTransportTrip[] = Array.from({ length: 5_000 }, (_, index) =>
      Object.freeze({
        tripId: `trip-${String(index).padStart(5, '0')}`,
        citizenId: `citizen-${String(index).padStart(5, '0')}`,
        mode: 'Drive' as const,
        originBuildingId: 'home',
        destinationBuildingId: 'work',
        routeEdgeIds: Object.freeze(['ab']),
        routeGraphRevision: 1,
        segmentIndex: 0,
        progressQ: index % 1_000_000,
        lastStableNodeId: 'A',
        queuedMovement: null,
        status: 'Active' as const,
        failureReason: null,
      }),
    );
    const snapshot = createTrafficSnapshot({
      schemaVersion: 1,
      revision: 1,
      policyVersion: 1,
      graphSourceRoadRevision: 1,
      graphSourceBuildingRevision: 1,
      activeTrips: trips,
    });
    const projection = createTrafficEdgeProjections({ graph, trips: snapshot.activeTrips });
    expect(snapshot.activeTrips).toHaveLength(5_000);
    expect(projection[0]?.activeTripCount).toBe(5_000);
    expect(JSON.stringify(snapshot)).not.toContain('Object3D');
    expect(JSON.stringify(snapshot)).not.toContain('camera');
  });
});
