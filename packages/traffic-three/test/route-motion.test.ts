import { describe, expect, it } from 'vitest';
import * as trafficThree from '../src/index.js';
import { headingRadians, sampleRoutePolyline, type TrafficRouteSegment } from '../src/index.js';

const route: readonly TrafficRouteSegment[] = Object.freeze([
  Object.freeze({
    edgeId: 'east',
    from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
    to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
  }),
  Object.freeze({
    edgeId: 'south',
    from: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
    to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 8_000 }),
  }),
]);

describe('traffic presentation route motion', () => {
  it('samples the route polyline and tangent instead of cutting across a corner', () => {
    const sample = sampleRoutePolyline(route, 10_000);

    expect(sample.position.x).toBeCloseTo(8);
    expect(sample.position.z).toBeCloseTo(2);
    expect(sample.headingRadians).toBeCloseTo(0);
    expect(headingRadians(route[0]!.from, route[0]!.to)).toBeCloseTo(Math.PI / 2);
  });

  it('exposes prepared-route sampling for the frame hot path', () => {
    const prepare = Reflect.get(trafficThree, 'prepareTrafficRoute') as unknown;
    const sampleInto = Reflect.get(trafficThree, 'samplePreparedRouteInto') as unknown;

    expect(typeof prepare).toBe('function');
    expect(typeof sampleInto).toBe('function');
  });

  it('keeps a vehicle visual bound to its trip while reusing the pool', async () => {
    const { TrafficVehiclePool } = await import('../src/index.js');
    const pool = new TrafficVehiclePool();
    const input = {
      tripId: 'trip-stable',
      citizenId: 'citizen-stable',
      routeEdgeId: 'east',
      progressQ: 100_000,
      queued: false,
      from: route[0]!.from,
      to: route[0]!.to,
      turn: null,
    } as const;
    const first = pool.acquire(input);
    const second = pool.acquire({ ...input, progressQ: 200_000 });

    expect(second).toBe(first);
    expect(second.tripId).toBe('trip-stable');
    pool.dispose();
  });
});
