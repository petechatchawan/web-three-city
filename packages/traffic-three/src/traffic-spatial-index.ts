import type { TrafficSpatialQueryMetrics } from './traffic-presentation-metrics.js';
import type { TrafficWorldPointQ } from './route-geometry.js';

export interface TrafficSpatialAgent {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
  readonly from: TrafficWorldPointQ;
  readonly to: TrafficWorldPointQ;
}

export interface TrafficSpatialQuery {
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
}

export interface TrafficSpatialCandidate<T extends TrafficSpatialAgent = TrafficSpatialAgent> {
  readonly agent: T;
  readonly distanceSquared: number;
}

export interface TrafficSpatialQueryResult<T extends TrafficSpatialAgent = TrafficSpatialAgent> {
  readonly candidates: readonly TrafficSpatialCandidate<T>[];
  readonly metrics: TrafficSpatialQueryMetrics;
}

interface BucketBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const Q_PER_METER = 1_000;

function meters(valueQ: number): number {
  return valueQ / Q_PER_METER;
}

function bucketKey(x: number, z: number): string {
  return `${x},${z}`;
}

function segmentDistanceSquared(
  centerX: number,
  centerZ: number,
  from: TrafficWorldPointQ,
  to: TrafficWorldPointQ,
): number {
  const ax = meters(from.xQ);
  const az = meters(from.zQ);
  const bx = meters(to.xQ);
  const bz = meters(to.zQ);
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((centerX - ax) * dx + (centerZ - az) * dz) / lengthSquared));
  const px = ax + dx * t;
  const pz = az + dz * t;
  const offsetX = centerX - px;
  const offsetZ = centerZ - pz;
  return offsetX * offsetX + offsetZ * offsetZ;
}

export class TrafficSpatialIndex<T extends TrafficSpatialAgent = TrafficSpatialAgent> {
  readonly #bucketSize: number;
  readonly #buckets = new Map<string, T[]>();
  readonly #bucketBounds = new Map<string, BucketBounds>();
  readonly #tripCount: number;

  constructor(agents: readonly T[], bucketSizeMeters = 64) {
    if (!Number.isFinite(bucketSizeMeters) || bucketSizeMeters <= 0) {
      throw new RangeError('traffic-three:invalid-spatial-bucket-size');
    }
    this.#bucketSize = bucketSizeMeters;
    this.#tripCount = agents.length;
    const seenTripIds = new Set<string>();
    for (const agent of agents) {
      if (seenTripIds.has(agent.tripId)) throw new Error('traffic-three:duplicate-spatial-trip');
      seenTripIds.add(agent.tripId);
      const minX = Math.min(meters(agent.from.xQ), meters(agent.to.xQ));
      const maxX = Math.max(meters(agent.from.xQ), meters(agent.to.xQ));
      const minZ = Math.min(meters(agent.from.zQ), meters(agent.to.zQ));
      const maxZ = Math.max(meters(agent.from.zQ), meters(agent.to.zQ));
      const minBucketX = Math.floor(minX / this.#bucketSize);
      const maxBucketX = Math.floor(maxX / this.#bucketSize);
      const minBucketZ = Math.floor(minZ / this.#bucketSize);
      const maxBucketZ = Math.floor(maxZ / this.#bucketSize);
      for (let bucketZ = minBucketZ; bucketZ <= maxBucketZ; bucketZ += 1) {
        for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
          const key = bucketKey(bucketX, bucketZ);
          const list = this.#buckets.get(key) ?? [];
          list.push(agent);
          this.#buckets.set(key, list);
          this.#bucketBounds.set(
            key,
            Object.freeze({
              minX: bucketX * this.#bucketSize,
              maxX: (bucketX + 1) * this.#bucketSize,
              minZ: bucketZ * this.#bucketSize,
              maxZ: (bucketZ + 1) * this.#bucketSize,
            }),
          );
        }
      }
    }
    for (const list of this.#buckets.values()) {
      list.sort((a, b) => (a.tripId < b.tripId ? -1 : a.tripId > b.tripId ? 1 : 0));
    }
  }

  get tripCount(): number {
    return this.#tripCount;
  }

  get bucketCount(): number {
    return this.#buckets.size;
  }

  query(query: TrafficSpatialQuery): TrafficSpatialQueryResult<T> {
    if (
      !Number.isFinite(query.centerX) ||
      !Number.isFinite(query.centerZ) ||
      !Number.isFinite(query.radius) ||
      query.radius < 0
    ) {
      throw new RangeError('traffic-three:invalid-spatial-query');
    }
    const minBucketX = Math.floor((query.centerX - query.radius) / this.#bucketSize);
    const maxBucketX = Math.floor((query.centerX + query.radius) / this.#bucketSize);
    const minBucketZ = Math.floor((query.centerZ - query.radius) / this.#bucketSize);
    const maxBucketZ = Math.floor((query.centerZ + query.radius) / this.#bucketSize);
    const visitedBucketKeys: string[] = [];
    const candidateByTrip = new Map<string, T>();

    for (let bucketZ = minBucketZ; bucketZ <= maxBucketZ; bucketZ += 1) {
      for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
        const key = bucketKey(bucketX, bucketZ);
        const list = this.#buckets.get(key);
        if (list === undefined) continue;
        visitedBucketKeys.push(key);
        for (const agent of list) candidateByTrip.set(agent.tripId, agent);
      }
    }

    const radiusSquared = query.radius * query.radius;
    const candidates = [...candidateByTrip.values()]
      .map((agent) =>
        Object.freeze({
          agent,
          distanceSquared: segmentDistanceSquared(query.centerX, query.centerZ, agent.from, agent.to),
        }),
      )
      .filter((candidate) => candidate.distanceSquared <= radiusSquared)
      .sort((a, b) =>
        a.distanceSquared !== b.distanceSquared
          ? a.distanceSquared - b.distanceSquared
          : a.agent.tripId < b.agent.tripId
            ? -1
            : a.agent.tripId > b.agent.tripId
              ? 1
              : 0,
      );

    return Object.freeze({
      candidates: Object.freeze(candidates),
      metrics: Object.freeze({
        bucketCount: this.#buckets.size,
        visitedBucketCount: visitedBucketKeys.length,
        candidateTripCount: candidateByTrip.size,
      }),
    });
  }
}

export function buildTrafficSpatialIndex<T extends TrafficSpatialAgent>(
  agents: readonly T[],
  bucketSizeMeters = 64,
): TrafficSpatialIndex<T> {
  return new TrafficSpatialIndex(agents, bucketSizeMeters);
}

export function queryTrafficSpatialIndex<T extends TrafficSpatialAgent>(
  index: TrafficSpatialIndex<T>,
  query: TrafficSpatialQuery,
): TrafficSpatialQueryResult<T> {
  return index.query(query);
}
