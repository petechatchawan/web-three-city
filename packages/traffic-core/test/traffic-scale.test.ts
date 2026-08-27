import { describe, expect, it } from 'vitest';
import * as trafficCore from '../src/index.js';
import {
  createTrafficEdgeProjections,
  createTrafficSnapshot,
  type ActiveTransportTrip,
  type TrafficGraph,
} from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';

type ScaleApi = Readonly<{
  createTrafficScaleInstrumentation: () => Readonly<{
    record: () => void;
    snapshot: () => Readonly<{
      laneBucketTripWrites: number;
      neighborChecks: number;
      arbitrationCandidateCount: number;
      arbitrationResourceChecks: number;
      graphMetadataBuildCount: number;
      graphMetadataReuseCount: number;
      flowTripVisits: number;
      flowEdgeVisits: number;
    }>;
  }>;
  TrafficGraphMetadataCache: new () => unknown;
  advanceTrafficQuantum: (
    input: Readonly<{
      snapshot: import('../src/index.js').TrafficSnapshotV2;
      graph: TrafficGraph;
      scaleInstrumentation: ReturnType<ScaleApi['createTrafficScaleInstrumentation']>;
      graphMetadataCache: unknown;
    }>,
  ) => Readonly<{ snapshot: import('../src/index.js').TrafficSnapshotV2 }>;
  fingerprintTrafficSnapshot: (snapshot: import('../src/index.js').TrafficSnapshotV2) => string;
  createTrafficEdgeProjections: (
    input: Readonly<{
      graph: TrafficGraph;
      trips: readonly ActiveTransportTrip[];
      scaleInstrumentation: ReturnType<ScaleApi['createTrafficScaleInstrumentation']>;
    }>,
  ) => readonly unknown[];
}>;

const scaleApi = trafficCore as unknown as ScaleApi;

const SCALE_TRIP_COUNT = 5_000;

function scaleGraph(): TrafficGraph {
  const nodes = Array.from({ length: SCALE_TRIP_COUNT + 2 }, (_, index) =>
    Object.freeze({ nodeId: `node-${index}`, xQ: index * 8_000, yQ: 0, zQ: 0 }),
  );
  return Object.freeze({
    sourceRoadRevision: 20,
    sourceBuildingRevision: 20,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(
      Array.from({ length: SCALE_TRIP_COUNT + 1 }, (_, index) =>
        Object.freeze({
          edgeId: index === 0 ? 'shared' : `edge-${index}`,
          fromNodeId: index === 0 ? 'node-0' : `node-${index}`,
          toNodeId: index === 0 ? 'node-1' : `node-${index + 1}`,
          mode: 'Drive' as const,
          lengthQ: 8_000,
          freeFlowTravelSeconds: 16,
          capacityUnits: 5_000,
        }),
      ),
    ),
  });
}

function scaleSnapshot() {
  return trafficCore.createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: 1,
    policyVersion: 1,
    graphSourceRoadRevision: 20,
    graphSourceBuildingRevision: 20,
    timeCursor: {
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: trafficCore.absoluteTransportSecond(1_920),
      temporalPolicyVersion: 1,
    },
    activeTrips: Array.from({ length: SCALE_TRIP_COUNT }, (_, index) =>
      Object.freeze({
        tripId: `trip-${String(index).padStart(5, '0')}`,
        citizenId: `citizen-${String(index).padStart(5, '0')}`,
        mode: 'Drive' as const,
        originBuildingId: 'home',
        destinationBuildingId: 'work',
        routeEdgeIds: Object.freeze(['shared', `edge-${index + 1}`]),
        routeGraphRevision: 20,
        segmentIndex: 1,
        progressQ: 100_000,
        lastStableNodeId: `node-${index + 1}`,
        queuedMovement: null,
        status: 'Active' as const,
        failureReason: null,
        driveMovementPhase: 'Travelling' as const,
        entryServiceCredit: 0,
        entryReservationResourceIds: Object.freeze([]),
      }),
    ),
  });
}

function flowScaleTrips(): readonly ActiveTransportTrip[] {
  return Object.freeze(
    Array.from({ length: SCALE_TRIP_COUNT }, (_, index) =>
      Object.freeze({
        tripId: `flow-trip-${String(index).padStart(5, '0')}`,
        citizenId: `flow-citizen-${String(index).padStart(5, '0')}`,
        mode: 'Drive' as const,
        originBuildingId: 'home',
        destinationBuildingId: 'work',
        routeEdgeIds: Object.freeze([`edge-${index + 1}`]),
        routeGraphRevision: 20,
        segmentIndex: 0,
        progressQ: 100_000,
        lastStableNodeId: `node-${index + 1}`,
        queuedMovement: null,
        status: 'Active' as const,
        failureReason: null,
      }),
    ),
  );
}

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

  it('projects dense-graph Traffic flow with one trip pass and one edge pass', () => {
    const instrumentation = scaleApi.createTrafficScaleInstrumentation();
    const trips = flowScaleTrips();
    const graph = scaleGraph();

    const projection = scaleApi.createTrafficEdgeProjections({
      graph,
      trips,
      scaleInstrumentation: instrumentation,
    });

    expect(projection).toHaveLength(graph.edges.length);
    expect(instrumentation.snapshot()).toMatchObject({
      flowTripVisits: trips.length,
      flowEdgeVisits: graph.edges.length,
    });
  });

  it('keeps 5,000 authoritative lane checks and arbitration work below all-pairs work', () => {
    expect(scaleApi.createTrafficScaleInstrumentation).toEqual(expect.any(Function));

    const instrumentation = scaleApi.createTrafficScaleInstrumentation();
    const result = scaleApi.advanceTrafficQuantum({
      snapshot: scaleSnapshot(),
      graph: scaleGraph(),
      scaleInstrumentation: instrumentation,
      graphMetadataCache: new scaleApi.TrafficGraphMetadataCache(),
    });
    const work = instrumentation.snapshot();
    const allPairs = SCALE_TRIP_COUNT * (SCALE_TRIP_COUNT - 1);

    expect(work.laneBucketTripWrites).toBeLessThan(allPairs);
    expect(work.neighborChecks).toBeLessThan(allPairs);
    expect(work.arbitrationCandidateCount).toBeLessThan(allPairs);
    expect(work.arbitrationResourceChecks).toBeLessThan(allPairs);
    expect(result.snapshot.activeTrips).toHaveLength(SCALE_TRIP_COUNT);
  });

  it('repeats the 5,000-trip quantum with identical fingerprint, ordering, and reservations', () => {
    expect(scaleApi.createTrafficScaleInstrumentation).toEqual(expect.any(Function));

    const graph = scaleGraph();
    const first = scaleApi.advanceTrafficQuantum({
      snapshot: scaleSnapshot(),
      graph,
      scaleInstrumentation: scaleApi.createTrafficScaleInstrumentation(),
      graphMetadataCache: new scaleApi.TrafficGraphMetadataCache(),
    });
    const second = scaleApi.advanceTrafficQuantum({
      snapshot: scaleSnapshot(),
      graph,
      scaleInstrumentation: scaleApi.createTrafficScaleInstrumentation(),
      graphMetadataCache: new scaleApi.TrafficGraphMetadataCache(),
    });

    expect(scaleApi.fingerprintTrafficSnapshot(first.snapshot)).toBe(
      scaleApi.fingerprintTrafficSnapshot(second.snapshot),
    );
    expect(first.snapshot.activeTrips.map((trip) => trip.tripId)).toEqual(
      second.snapshot.activeTrips.map((trip) => trip.tripId),
    );
    expect(
      first.snapshot.activeTrips.map((trip) => trip.activeNodeTraversal?.reservedResourceIds ?? []),
    ).toEqual(
      second.snapshot.activeTrips.map(
        (trip) => trip.activeNodeTraversal?.reservedResourceIds ?? [],
      ),
    );
  });

  it('reuses graph metadata across unchanged revision/frame work', () => {
    expect(scaleApi.createTrafficScaleInstrumentation).toEqual(expect.any(Function));

    const graph = scaleGraph();
    const instrumentation = scaleApi.createTrafficScaleInstrumentation();
    const graphMetadataCache = new scaleApi.TrafficGraphMetadataCache();
    scaleApi.advanceTrafficQuantum({
      snapshot: scaleSnapshot(),
      graph,
      scaleInstrumentation: instrumentation,
      graphMetadataCache,
    });
    scaleApi.advanceTrafficQuantum({
      snapshot: scaleSnapshot(),
      graph,
      scaleInstrumentation: instrumentation,
      graphMetadataCache,
    });

    expect(instrumentation.snapshot()).toMatchObject({
      graphMetadataBuildCount: 1,
      graphMetadataReuseCount: 1,
    });
  });
});
