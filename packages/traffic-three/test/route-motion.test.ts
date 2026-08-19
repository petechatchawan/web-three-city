import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import * as trafficThree from '../src/index.js';
import {
  deriveDirectedLanePath,
  headingRadians,
  prepareTrafficRoute,
  samplePreparedRouteInto,
  sampleRoutePolyline,
  type TrafficRouteSegment,
} from '../src/index.js';

interface PreparedSegmentView {
  readonly curveLookup: unknown;
  readonly startDistanceMillimeters: number;
  readonly endDistanceMillimeters: number;
}

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

  it('prepares cubic connector arc-length data and samples continuous tangent heading', () => {
    const lanePath = deriveDirectedLanePath(route, {
      laneOffsetsQ: [1_200, 1_200],
      junctionHalfExtentQ: 2_500,
      connectorSampleCount: 8,
    });
    const prepared = prepareTrafficRoute(lanePath.segments);
    const preparedSegments = Reflect.get(prepared, 'preparedSegments') as
      readonly PreparedSegmentView[] | undefined;

    expect(preparedSegments).toBeDefined();
    expect(preparedSegments).toHaveLength(lanePath.segments.length);
    const curveSegments = preparedSegments!.filter((segment) => segment.curveLookup !== null);
    expect(curveSegments).toHaveLength(2);
    for (const segment of curveSegments) {
      expect(segment.endDistanceMillimeters).toBeGreaterThan(segment.startDistanceMillimeters);
    }

    const firstCurve = curveSegments[0]!;
    const secondCurve = curveSegments[1]!;
    const boundary = firstCurve.endDistanceMillimeters;
    expect(boundary).toBe(secondCurve.startDistanceMillimeters);

    const headings: number[] = [];
    const distances = [boundary - 600, boundary - 300, boundary, boundary + 300, boundary + 600];
    for (const distance of distances) {
      const position = new Vector3();
      const sample = samplePreparedRouteInto(prepared, distance, position);
      headings.push(sample.headingRadians);
    }
    for (let index = 1; index < headings.length; index += 1) {
      expect(Math.abs(headings[index]! - headings[index - 1]!)).toBeLessThan(Math.PI / 4);
    }

    const preparedAgain = prepareTrafficRoute(lanePath.segments);
    expect(preparedAgain.totalLengthMillimeters).toBe(prepared.totalLengthMillimeters);
    expect(Array.from(preparedAgain.cumulativeEndMillimeters)).toEqual(
      Array.from(prepared.cumulativeEndMillimeters),
    );
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
