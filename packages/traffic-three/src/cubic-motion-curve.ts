import type { TrafficWorldPointQ } from './route-geometry.js';

export interface TrafficCubicCurveQ {
  readonly p0: TrafficWorldPointQ;
  readonly p1: TrafficWorldPointQ;
  readonly p2: TrafficWorldPointQ;
  readonly p3: TrafficWorldPointQ;
}

export interface TrafficCubicArcLengthLookup {
  readonly tSamples: Float64Array;
  readonly cumulativeMillimeters: Float64Array;
  readonly totalLengthMillimeters: number;
}

function validatePoint(point: TrafficWorldPointQ): void {
  if (
    !Number.isSafeInteger(point.xQ) ||
    !Number.isSafeInteger(point.yQ) ||
    !Number.isSafeInteger(point.zQ)
  ) {
    throw new RangeError('traffic-three:invalid-cubic-curve');
  }
}

function validateCurve(curve: TrafficCubicCurveQ): void {
  validatePoint(curve.p0);
  validatePoint(curve.p1);
  validatePoint(curve.p2);
  validatePoint(curve.p3);
}

function midpoint(first: TrafficWorldPointQ, second: TrafficWorldPointQ): TrafficWorldPointQ {
  return Object.freeze({
    xQ: Math.round((first.xQ + second.xQ) / 2),
    yQ: Math.round((first.yQ + second.yQ) / 2),
    zQ: Math.round((first.zQ + second.zQ) / 2),
  });
}

export function trafficCubicPoint(curve: TrafficCubicCurveQ, t: number): TrafficWorldPointQ {
  validateCurve(curve);
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new RangeError('traffic-three:invalid-cubic-curve');
  }
  const oneMinusT = 1 - t;
  const a = oneMinusT * oneMinusT * oneMinusT;
  const b = 3 * oneMinusT * oneMinusT * t;
  const c = 3 * oneMinusT * t * t;
  const d = t * t * t;
  return Object.freeze({
    xQ: Math.round(a * curve.p0.xQ + b * curve.p1.xQ + c * curve.p2.xQ + d * curve.p3.xQ),
    yQ: Math.round(a * curve.p0.yQ + b * curve.p1.yQ + c * curve.p2.yQ + d * curve.p3.yQ),
    zQ: Math.round(a * curve.p0.zQ + b * curve.p1.zQ + c * curve.p2.zQ + d * curve.p3.zQ),
  });
}

export function trafficCubicTangentXZ(
  curve: TrafficCubicCurveQ,
  t: number,
): Readonly<{ x: number; z: number }> {
  validateCurve(curve);
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new RangeError('traffic-three:invalid-cubic-curve');
  }
  const oneMinusT = 1 - t;
  const x =
    3 * oneMinusT * oneMinusT * (curve.p1.xQ - curve.p0.xQ) +
    6 * oneMinusT * t * (curve.p2.xQ - curve.p1.xQ) +
    3 * t * t * (curve.p3.xQ - curve.p2.xQ);
  const z =
    3 * oneMinusT * oneMinusT * (curve.p1.zQ - curve.p0.zQ) +
    6 * oneMinusT * t * (curve.p2.zQ - curve.p1.zQ) +
    3 * t * t * (curve.p3.zQ - curve.p2.zQ);
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length <= 0) {
    throw new RangeError('traffic-three:invalid-cubic-curve');
  }
  return Object.freeze({ x: x / length, z: z / length });
}

export function splitTrafficCubicCurveHalf(
  curve: TrafficCubicCurveQ,
): readonly [TrafficCubicCurveQ, TrafficCubicCurveQ] {
  validateCurve(curve);
  const q0 = midpoint(curve.p0, curve.p1);
  const q1 = midpoint(curve.p1, curve.p2);
  const q2 = midpoint(curve.p2, curve.p3);
  const r0 = midpoint(q0, q1);
  const r1 = midpoint(q1, q2);
  const split = midpoint(r0, r1);
  return Object.freeze([
    Object.freeze({ p0: curve.p0, p1: q0, p2: r0, p3: split }),
    Object.freeze({ p0: split, p1: r1, p2: q2, p3: curve.p3 }),
  ]);
}

export function prepareTrafficCubicArcLength(
  curve: TrafficCubicCurveQ,
  sampleCount = 8,
): TrafficCubicArcLengthLookup {
  validateCurve(curve);
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 4 || sampleCount % 2 !== 0) {
    throw new RangeError('traffic-three:invalid-cubic-curve');
  }
  const tSamples = new Float64Array(sampleCount + 1);
  const cumulativeMillimeters = new Float64Array(sampleCount + 1);
  let previous = curve.p0;
  let totalLengthMillimeters = 0;
  for (let index = 1; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const next = trafficCubicPoint(curve, t);
    const segmentLength = Math.hypot(
      next.xQ - previous.xQ,
      next.yQ - previous.yQ,
      next.zQ - previous.zQ,
    );
    totalLengthMillimeters += segmentLength;
    tSamples[index] = t;
    cumulativeMillimeters[index] = totalLengthMillimeters;
    previous = next;
  }
  if (!Number.isFinite(totalLengthMillimeters) || totalLengthMillimeters <= 0) {
    throw new RangeError('traffic-three:invalid-cubic-curve');
  }
  return Object.freeze({
    tSamples,
    cumulativeMillimeters,
    totalLengthMillimeters: Math.max(1, Math.ceil(totalLengthMillimeters)),
  });
}
