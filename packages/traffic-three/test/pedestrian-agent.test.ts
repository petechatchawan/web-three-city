import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  TrafficPedestrianPool,
  pedestrianAppearanceForCitizen,
  sampleRouteEdgePosition,
} from '../src/index.js';

describe('Traffic pedestrian agents', () => {
  it('materializes a real Citizen trip with deterministic appearance and route position', () => {
    const pool = new TrafficPedestrianPool();
    const input = {
      tripId: 'walk-trip-1',
      citizenId: 'citizen-1',
      routeEdgeId: 'walk-edge-1',
      progressQ: 500_000,
      queued: false,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
    } as const;
    const agent = pool.acquire(input);
    expect(agent.object.userData).toMatchObject({
      trafficAgentKind: 'citizen',
      citizenId: 'citizen-1',
      tripId: 'walk-trip-1',
      trafficVisualState: 'Walk',
    });
    expect(agent.object.position.toArray()).toEqual(
      sampleRouteEdgePosition(input.from, input.to, 500_000).toArray(),
    );
    expect(pedestrianAppearanceForCitizen('citizen-1')).toEqual(
      pedestrianAppearanceForCitizen('citizen-1'),
    );
    pool.dispose();
  });

  it('keeps the complete Citizen visual subordinate to the basic-road vehicle envelope', () => {
    const pool = new TrafficPedestrianPool();
    const agent = pool.acquire({
      tripId: 'walk-scale-1',
      citizenId: 'citizen-scale-1',
      routeEdgeId: 'walk-edge-1',
      progressQ: 500_000,
      queued: false,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
    });
    const size = new Box3().setFromObject(agent.object).getSize(new Vector3());

    expect(size.x).toBeLessThanOrEqual(0.1);
    expect(size.y).toBeLessThanOrEqual(0.26);
    pool.dispose();
  });

  it('reuses the same pooled hierarchy after dematerialization', () => {
    const pool = new TrafficPedestrianPool();
    const base = {
      citizenId: 'citizen-1',
      routeEdgeId: 'walk-edge-1',
      progressQ: 0,
      queued: false,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
    } as const;
    pool.acquire({ ...base, tripId: 'trip-1' });
    pool.release('trip-1');
    pool.acquire({ ...base, tripId: 'trip-2' });
    expect(pool.createdCount).toBe(1);
    expect(pool.reuseCount).toBe(1);
    pool.dispose();
  });
});
