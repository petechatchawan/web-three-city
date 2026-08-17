import { describe, expect, it } from 'vitest';
import {
  TrafficSpatialIndex,
  selectTrafficAgentsForMaterialization,
  type TrafficSpatialAgent,
} from '../src/index.js';

function agent(index: number): TrafficSpatialAgent {
  const x = (index % 100) * 4;
  const z = Math.floor(index / 100) * 4;
  return Object.freeze({
    tripId: `trip-${String(index).padStart(5, '0')}`,
    citizenId: `citizen-${String(index).padStart(5, '0')}`,
    mode: index % 2 === 0 ? ('Walk' as const) : ('Drive' as const),
    routeEdgeId: `edge-${index % 250}`,
    progressQ: (index * 17_171) % 1_000_000,
    queued: false,
    from: Object.freeze({ xQ: x * 1_000, yQ: 0, zQ: z * 1_000 }),
    to: Object.freeze({ xQ: (x + 1) * 1_000, yQ: 0, zQ: z * 1_000 }),
  });
}

describe('Traffic materializer release scale', () => {
  it('keeps 5,000 logical agents while querying and materializing a bounded deterministic subset', () => {
    const logical = Object.freeze(Array.from({ length: 5_000 }, (_, index) => agent(index)));
    const index = new TrafficSpatialIndex(logical, 16);
    const query = index.query({ centerX: 80, centerZ: 80, radius: 48 });
    const first = selectTrafficAgentsForMaterialization({
      candidates: query.candidates,
      frameIndex: 0,
    });
    const second = selectTrafficAgentsForMaterialization({
      candidates: [...query.candidates].reverse(),
      frameIndex: 0,
    });

    expect(logical).toHaveLength(5_000);
    expect(query.metrics.candidateTripCount).toBeLessThan(logical.length);
    expect(query.metrics.visitedBucketCount).toBeLessThan(query.metrics.bucketCount);
    expect(first.pedestrianCount).toBeLessThanOrEqual(300);
    expect(first.vehicleCount).toBeLessThanOrEqual(300);
    expect(first.nearCount).toBeLessThanOrEqual(500);
    expect(first.selected.map((entry) => entry.agent.tripId)).toEqual(
      second.selected.map((entry) => entry.agent.tripId),
    );
  });
});
