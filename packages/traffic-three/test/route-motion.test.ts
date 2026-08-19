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

interface VehicleKinematicsStateView {
  visualDistanceMillimeters: number;
  visualSpeedMillimetersPerSecond: number;
  canonicalTargetDistanceMillimeters: number;
  baselineFollowerSpeedMillimetersPerSecond: number;
  lastFrameTimestampMs: number;
}

type CreateVehicleKinematicsState = (
  initialDistanceMillimeters: number,
  timestampMs: number,
) => VehicleKinematicsStateView;

type SetVehicleKinematicsTarget = (
  state: VehicleKinematicsStateView,
  targetDistanceMillimeters: number,
  committedDeltaSeconds: number,
) => void;

type AdvanceVehicleKinematics = (
  state: VehicleKinematicsStateView,
  input: Readonly<{
    timestampMs: number;
    queued: boolean;
    preparedRoute: ReturnType<typeof prepareTrafficRoute>;
    cellPresentationLengthMillimeters: number;
  }>,
) => void;

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

function requireKinematicsApi(): Readonly<{
  createState: CreateVehicleKinematicsState;
  setTarget: SetVehicleKinematicsTarget;
  advance: AdvanceVehicleKinematics;
}> {
  const createState = Reflect.get(trafficThree, 'createVehicleKinematicsState') as unknown;
  const setTarget = Reflect.get(trafficThree, 'setVehicleKinematicsTarget') as unknown;
  const advance = Reflect.get(trafficThree, 'advanceVehicleKinematics') as unknown;

  expect(Reflect.get(trafficThree, 'FOUNDATION_VEHICLE_MOTION_PRESENTATION_POLICY')).toEqual({
    accelerationResponseSeconds: 0.45,
    decelerationResponseSeconds: 0.3,
    turnSpeedFactor: 0.55,
    turnApproachCellFraction: 0.35,
    maxCatchupSpeedMultiplier: 1.5,
    stopSpeedEpsilonMillimetersPerSecond: 10,
  });
  expect(typeof createState).toBe('function');
  expect(typeof setTarget).toBe('function');
  expect(typeof advance).toBe('function');
  return {
    createState: createState as CreateVehicleKinematicsState,
    setTarget: setTarget as SetVehicleKinematicsTarget,
    advance: advance as AdvanceVehicleKinematics,
  };
}

function straightPreparedRoute(): ReturnType<typeof prepareTrafficRoute> {
  return prepareTrafficRoute([
    Object.freeze({
      edgeId: 'straight',
      from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
      to: Object.freeze({ xQ: 100_000, yQ: 0, zQ: 0 }),
      movementKind: 'straight' as const,
    }),
  ]);
}

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

  it('accelerates progressively and never advances ahead of canonical Traffic progress', () => {
    const { createState, setTarget, advance } = requireKinematicsApi();
    const prepared = straightPreparedRoute();
    const state = createState(0, 0);
    setTarget(state, 8_000, 1);

    advance(state, {
      timestampMs: 100,
      queued: false,
      preparedRoute: prepared,
      cellPresentationLengthMillimeters: 8_000,
    });

    expect(state.visualSpeedMillimetersPerSecond).toBeGreaterThan(0);
    expect(state.visualSpeedMillimetersPerSecond).toBeLessThan(
      state.baselineFollowerSpeedMillimetersPerSecond,
    );
    expect(state.visualDistanceMillimeters).toBeGreaterThan(0);
    expect(state.visualDistanceMillimeters).toBeLessThanOrEqual(
      state.canonicalTargetDistanceMillimeters,
    );
  });

  it('brakes progressively while queued and reduces speed before and through a turn', () => {
    const { createState, setTarget, advance } = requireKinematicsApi();
    const straight = straightPreparedRoute();
    const turning = prepareTrafficRoute(
      deriveDirectedLanePath(route, {
        laneOffsetsQ: [1_200, 1_200],
        junctionHalfExtentQ: 2_500,
        connectorSampleCount: 8,
      }).segments,
    );

    const queued = createState(0, 0);
    setTarget(queued, 40_000, 2);
    advance(queued, {
      timestampMs: 500,
      queued: false,
      preparedRoute: straight,
      cellPresentationLengthMillimeters: 8_000,
    });
    const cruisingSpeed = queued.visualSpeedMillimetersPerSecond;
    const brakingSpeeds: number[] = [];
    for (const timestampMs of [600, 700, 800]) {
      advance(queued, {
        timestampMs,
        queued: true,
        preparedRoute: straight,
        cellPresentationLengthMillimeters: 8_000,
      });
      brakingSpeeds.push(queued.visualSpeedMillimetersPerSecond);
    }
    expect(brakingSpeeds[0]!).toBeLessThan(cruisingSpeed);
    expect(brakingSpeeds[1]!).toBeLessThan(brakingSpeeds[0]!);
    expect(brakingSpeeds[2]!).toBeLessThan(brakingSpeeds[1]!);

    const firstTurn = turning.preparedSegments.find(
      (segment) => segment.source.movementKind === 'turn-right',
    );
    expect(firstTurn).toBeDefined();
    const approachDistance = Math.max(0, firstTurn!.startDistanceMillimeters - 1_000);
    const straightState = createState(approachDistance, 0);
    const turnState = createState(approachDistance, 0);
    setTarget(straightState, straight.totalLengthMillimeters, 4);
    setTarget(turnState, turning.totalLengthMillimeters, 4);
    advance(straightState, {
      timestampMs: 500,
      queued: false,
      preparedRoute: straight,
      cellPresentationLengthMillimeters: 8_000,
    });
    advance(turnState, {
      timestampMs: 500,
      queued: false,
      preparedRoute: turning,
      cellPresentationLengthMillimeters: 8_000,
    });
    expect(turnState.visualSpeedMillimetersPerSecond).toBeLessThan(
      straightState.visualSpeedMillimetersPerSecond,
    );
  });

  it('stays materially stable across 30, 60, and 120 FPS elapsed-time schedules', () => {
    const { createState, setTarget, advance } = requireKinematicsApi();
    const prepared = straightPreparedRoute();
    const simulate = (fps: number): VehicleKinematicsStateView => {
      const state = createState(0, 0);
      setTarget(state, 100_000, 5);
      const frameMs = 1_000 / fps;
      for (let index = 1; index <= fps * 2; index += 1) {
        advance(state, {
          timestampMs: index * frameMs,
          queued: false,
          preparedRoute: prepared,
          cellPresentationLengthMillimeters: 8_000,
        });
      }
      return state;
    };

    const states = [simulate(30), simulate(60), simulate(120)];
    const distances = states.map((state) => state.visualDistanceMillimeters);
    const speeds = states.map((state) => state.visualSpeedMillimetersPerSecond);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThanOrEqual(40);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThanOrEqual(40);
    expect(states.every((state) => state.visualDistanceMillimeters <= 100_000)).toBe(true);
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
