import { compareTrafficId, type ActiveTransportTripV2, type TrafficGraph } from './contracts.js';
import { type TrafficScaleInstrumentation } from './traffic-scale-instrumentation.js';

export interface LaneOccupancyIndex {
  readonly laneSpanCount: number;
  readonly tripsByEdge: ReadonlyMap<string, readonly ActiveTransportTripV2[]>;
  readonly tripsBySharedEdge: ReadonlyMap<string, readonly ActiveTransportTripV2[]>;
  readonly driveEdgeIds: ReadonlySet<string>;
  readonly maxSegmentIndexBySharedEdge: ReadonlyMap<string, number>;
}

export function createLaneOccupancyIndex(
  input: Readonly<{
    graph: TrafficGraph;
    trips: readonly ActiveTransportTripV2[];
    scaleInstrumentation?: TrafficScaleInstrumentation;
  }>,
): LaneOccupancyIndex {
  const edgeIds = new Set(
    input.graph.edges.filter((edge) => edge.mode === 'Drive').map((edge) => edge.edgeId),
  );
  const buckets = new Map<string, ActiveTransportTripV2[]>();
  const sharedBuckets = new Map<string, ActiveTransportTripV2[]>();
  for (const trip of input.trips) {
    if (trip.mode !== 'Drive' || trip.status !== 'Active') continue;
    const edgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (edgeId === undefined || !edgeIds.has(edgeId)) continue;
    const bucket = buckets.get(edgeId) ?? [];
    bucket.push(trip);
    buckets.set(edgeId, bucket);
    input.scaleInstrumentation?.recordLaneBucketTripWrite();
    for (let routeIndex = 0; routeIndex <= trip.segmentIndex; routeIndex += 1) {
      const sharedEdgeId = trip.routeEdgeIds[routeIndex]!;
      const sharedBucket = sharedBuckets.get(sharedEdgeId) ?? [];
      sharedBucket.push(trip);
      sharedBuckets.set(sharedEdgeId, sharedBucket);
      input.scaleInstrumentation?.recordLaneBucketTripWrite();
    }
  }
  const tripsByEdge = new Map<string, readonly ActiveTransportTripV2[]>();
  for (const [edgeId, bucket] of buckets) {
    bucket.sort((first, second) =>
      first.progressQ !== second.progressQ
        ? second.progressQ - first.progressQ
        : compareTrafficId(first.tripId, second.tripId),
    );
    tripsByEdge.set(edgeId, Object.freeze(bucket));
  }
  const result = { laneSpanCount: tripsByEdge.size } as LaneOccupancyIndex;
  Object.defineProperty(result, 'tripsByEdge', {
    value: tripsByEdge,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  const tripsBySharedEdge = new Map<string, readonly ActiveTransportTripV2[]>();
  for (const [edgeId, bucket] of sharedBuckets) {
    bucket.sort((first, second) =>
      first.segmentIndex !== second.segmentIndex
        ? second.segmentIndex - first.segmentIndex
        : first.progressQ !== second.progressQ
          ? second.progressQ - first.progressQ
          : compareTrafficId(first.tripId, second.tripId),
    );
    tripsBySharedEdge.set(edgeId, Object.freeze(bucket));
  }
  Object.defineProperty(result, 'tripsBySharedEdge', {
    value: tripsBySharedEdge,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(result, 'driveEdgeIds', {
    value: edgeIds,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  const maxSegmentIndexBySharedEdge = new Map<string, number>();
  for (const [edgeId, bucket] of tripsBySharedEdge) {
    maxSegmentIndexBySharedEdge.set(edgeId, bucket[0]!.segmentIndex);
  }
  Object.defineProperty(result, 'maxSegmentIndexBySharedEdge', {
    value: maxSegmentIndexBySharedEdge,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(result);
}

export function canonicalHeadwayCapProgressQ(
  input: Readonly<{
    trip: ActiveTransportTripV2;
    proposedProgressQ: number;
    graph: TrafficGraph;
    occupancy: LaneOccupancyIndex;
    scaleInstrumentation?: TrafficScaleInstrumentation;
  }>,
): number {
  if (input.trip.mode !== 'Drive' || input.trip.status !== 'Active') return input.proposedProgressQ;
  const edgeId = input.trip.routeEdgeIds[input.trip.segmentIndex];
  if (edgeId === undefined) return input.proposedProgressQ;
  if (!input.occupancy.driveEdgeIds.has(edgeId)) return input.proposedProgressQ;
  const leaders = input.occupancy.tripsByEdge.get(edgeId) ?? [];
  input.scaleInstrumentation?.recordNeighborCheck();
  const first = leaders[0];
  const candidate = first?.tripId === input.trip.tripId ? leaders[1] : first;
  const leader =
    candidate !== undefined && candidate.progressQ >= input.trip.progressQ ? candidate : undefined;
  // A leader holding a receiving boundary reserves the remaining physical span.
  // This is a conservative forward-only cap; it never rewinds a current position.
  if (leader !== undefined && leader.queuedMovement !== null) {
    const edge = input.graph.edges.find((candidateEdge) => candidateEdge.edgeId === edgeId)!;
    const entryAllowanceQ = Math.max(1, Math.floor((edge.lengthQ * 1_000_000) / (8_000 * 40)));
    return Math.min(input.proposedProgressQ, input.trip.progressQ + entryAllowanceQ);
  }
  input.scaleInstrumentation?.recordNeighborCheck();
  if ((input.occupancy.maxSegmentIndexBySharedEdge.get(edgeId) ?? -1) > input.trip.segmentIndex) {
    return input.trip.progressQ;
  }
  return input.proposedProgressQ;
}
