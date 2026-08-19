import { describe, expect, it } from 'vitest';
import * as trafficThree from '../src/index.js';
import type { TrafficRouteSegment, TrafficWorldPointQ } from '../src/index.js';

type TrafficCubicCurveQ = Readonly<{
  p0: TrafficWorldPointQ;
  p1: TrafficWorldPointQ;
  p2: TrafficWorldPointQ;
  p3: TrafficWorldPointQ;
}>;

type DirectedLaneSegment = TrafficRouteSegment & {
  readonly sourceEdgeId: string;
  readonly kind: 'lane' | 'connector';
  readonly curve?: TrafficCubicCurveQ;
  readonly movementKind?: 'straight' | 'turn-left' | 'turn-right';
};

type DirectedLanePath = Readonly<{
  segments: readonly DirectedLaneSegment[];
  edgeSpans: readonly Readonly<{
    sourceEdgeId: string;
    startDistanceMillimeters: number;
    endDistanceMillimeters: number;
  }>[];
  turns: readonly Readonly<{
    junctionIndex: number;
    turn: 'straight' | 'left' | 'right';
  }>[];
}>;

type DeriveDirectedLaneSegment = (
  segment: TrafficRouteSegment,
  options: Readonly<{ laneOffsetQ: number; handedness?: 'left' | 'right' }>,
) => TrafficRouteSegment;

type DeriveDirectedLanePath = (
  route: readonly TrafficRouteSegment[],
  options: Readonly<{
    laneOffsetsQ: readonly number[];
    handedness?: 'left' | 'right';
    junctionHalfExtentQ?: number;
    connectorSampleCount?: number;
  }>,
) => DirectedLanePath;

const east: TrafficRouteSegment = Object.freeze({
  edgeId: 'east',
  from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
  to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
});

const west: TrafficRouteSegment = Object.freeze({
  edgeId: 'west',
  from: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
  to: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
});

function requireLaneApi(): Readonly<{
  deriveSegment: DeriveDirectedLaneSegment;
  derivePath: DeriveDirectedLanePath;
}> {
  const deriveSegment = Reflect.get(trafficThree, 'deriveDirectedLaneSegment') as unknown;
  const derivePath = Reflect.get(trafficThree, 'deriveDirectedLanePath') as unknown;
  expect(Reflect.get(trafficThree, 'FOUNDATION_TRAFFIC_HANDEDNESS')).toBe('left');
  expect(typeof deriveSegment).toBe('function');
  expect(typeof derivePath).toBe('function');
  return {
    deriveSegment: deriveSegment as DeriveDirectedLaneSegment,
    derivePath: derivePath as DeriveDirectedLanePath,
  };
}

function expectContinuous(segments: readonly DirectedLaneSegment[]): void {
  for (let index = 1; index < segments.length; index += 1) {
    expect(segments[index - 1]!.to).toEqual(segments[index]!.from);
  }
}

describe('PR3 directed lane path', () => {
  it('offsets opposing Drive directions onto opposite physical sides under left-hand traffic', () => {
    const { deriveSegment } = requireLaneApi();
    const eastbound = deriveSegment(east, { laneOffsetQ: 1_200 });
    const westbound = deriveSegment(west, { laneOffsetQ: 1_200 });

    expect([eastbound.from.zQ, eastbound.to.zQ]).toEqual([-1_200, -1_200]);
    expect([westbound.from.zQ, westbound.to.zQ]).toEqual([1_200, 1_200]);
    expect(eastbound.from.zQ).not.toBe(westbound.from.zQ);
  });

  it('preserves a C1-continuous cubic right-turn connector inside the junction envelope', () => {
    const { derivePath } = requireLaneApi();
    const south: TrafficRouteSegment = Object.freeze({
      edgeId: 'south',
      from: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
      to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 8_000 }),
    });
    const path = derivePath([east, south], {
      laneOffsetsQ: [1_200, 1_200],
      junctionHalfExtentQ: 2_500,
      connectorSampleCount: 4,
    });

    expect(path.turns).toEqual([{ junctionIndex: 0, turn: 'right' }]);
    const connector = path.segments.filter((segment) => segment.kind === 'connector');
    expect(connector).toHaveLength(2);
    expect(connector.map((segment) => segment.movementKind)).toEqual([
      'turn-right',
      'turn-right',
    ]);
    expect(connector.every((segment) => segment.curve !== undefined)).toBe(true);
    expectContinuous(path.segments);

    const first = connector[0]!;
    const last = connector[1]!;
    expect(first.curve!.p0).toEqual(first.from);
    expect(first.curve!.p3).toEqual(first.to);
    expect(last.curve!.p0).toEqual(last.from);
    expect(last.curve!.p3).toEqual(last.to);
    expect(first.to).toEqual(last.from);

    const startDx = first.curve!.p1.xQ - first.curve!.p0.xQ;
    const startDz = first.curve!.p1.zQ - first.curve!.p0.zQ;
    const endDx = last.curve!.p3.xQ - last.curve!.p2.xQ;
    const endDz = last.curve!.p3.zQ - last.curve!.p2.zQ;
    expect(Math.atan2(startDx, startDz)).toBeCloseTo(Math.PI / 2, 4);
    expect(Math.atan2(endDx, endDz)).toBeCloseTo(0, 4);

    for (const segment of connector) {
      for (const point of [segment.curve!.p0, segment.curve!.p1, segment.curve!.p2, segment.curve!.p3]) {
        expect(point.xQ).toBeGreaterThanOrEqual(5_500);
        expect(point.xQ).toBeLessThanOrEqual(10_500);
        expect(point.zQ).toBeGreaterThanOrEqual(-2_500);
        expect(point.zQ).toBeLessThanOrEqual(2_500);
      }
    }
    expect(path.edgeSpans.map((span) => span.sourceEdgeId)).toEqual(['east', 'south']);
  });

  it('keeps straight connectors continuous and rejects immediate U-turn generation', () => {
    const { derivePath } = requireLaneApi();
    const eastAgain: TrafficRouteSegment = Object.freeze({
      edgeId: 'east-again',
      from: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
      to: Object.freeze({ xQ: 16_000, yQ: 0, zQ: 0 }),
    });
    const straight = derivePath([east, eastAgain], {
      laneOffsetsQ: [1_200, 1_200],
      junctionHalfExtentQ: 2_500,
      connectorSampleCount: 4,
    });
    expect(straight.turns).toEqual([{ junctionIndex: 0, turn: 'straight' }]);
    expectContinuous(straight.segments);

    expect(() =>
      derivePath([east, west], {
        laneOffsetsQ: [1_200, 1_200],
        junctionHalfExtentQ: 2_500,
        connectorSampleCount: 4,
      }),
    ).toThrow('traffic-three:u-turn-not-supported');
  });
});
