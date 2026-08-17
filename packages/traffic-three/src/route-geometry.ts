import { TRAFFIC_PROGRESS_MAX_Q } from '@web-three-city/traffic-core';
import { Vector3 } from 'three';

export interface TrafficWorldPointQ {
  readonly xQ: number;
  readonly yQ: number;
  readonly zQ: number;
}

export interface TrafficRouteSegment {
  readonly edgeId: string;
  readonly from: TrafficWorldPointQ;
  readonly to: TrafficWorldPointQ;
  readonly lengthMillimeters?: number;
}

export interface TrafficRouteSample {
  readonly position: Vector3;
  readonly headingRadians: number;
  readonly segmentIndex: number;
}

export interface PreparedTrafficRoute {
  readonly segments: readonly TrafficRouteSegment[];
  readonly cumulativeEndMillimeters: Float64Array;
  readonly totalLengthMillimeters: number;
}

export interface MutableTrafficRouteSample {
  headingRadians: number;
  segmentIndex: number;
}

const WORLD_Q_PER_METER = 1_000;
const TURN_SMOOTHING_MILLIMETERS = 1_500;

function routeSegmentLengthMillimeters(segment: TrafficRouteSegment): number {
  if (
    segment.lengthMillimeters !== undefined &&
    Number.isSafeInteger(segment.lengthMillimeters) &&
    segment.lengthMillimeters > 0
  ) {
    return segment.lengthMillimeters;
  }
  const dx = segment.to.xQ - segment.from.xQ;
  const dy = segment.to.yQ - segment.from.yQ;
  const dz = segment.to.zQ - segment.from.zQ;
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz)));
}

function blendHeadings(first: number, second: number, secondWeight: number): number {
  const firstWeight = 1 - secondWeight;
  const firstX = Math.sin(first) * firstWeight;
  const firstZ = Math.cos(first) * firstWeight;
  const secondX = Math.sin(second) * secondWeight;
  const secondZ = Math.cos(second) * secondWeight;
  return Math.atan2(firstX + secondX, firstZ + secondZ);
}

function positionBetweenInto(
  from: TrafficWorldPointQ,
  to: TrafficWorldPointQ,
  progress: number,
  out: Vector3,
): void {
  out.set(
    (from.xQ + (to.xQ - from.xQ) * progress) / WORLD_Q_PER_METER,
    (from.yQ + (to.yQ - from.yQ) * progress) / WORLD_Q_PER_METER,
    (from.zQ + (to.zQ - from.zQ) * progress) / WORLD_Q_PER_METER,
  );
}

export function prepareTrafficRoute(route: readonly TrafficRouteSegment[]): PreparedTrafficRoute {
  if (route.length === 0) throw new RangeError('traffic-three:empty-route');
  const cumulativeEndMillimeters = new Float64Array(route.length);
  let totalLengthMillimeters = 0;
  for (let index = 0; index < route.length; index += 1) {
    totalLengthMillimeters += routeSegmentLengthMillimeters(route[index]!);
    cumulativeEndMillimeters[index] = totalLengthMillimeters;
  }
  return Object.freeze({
    segments: route,
    cumulativeEndMillimeters,
    totalLengthMillimeters,
  });
}

export function samplePreparedRouteInto(
  prepared: PreparedTrafficRoute,
  distanceAlongRouteMillimeters: number,
  outPosition: Vector3,
  outSample?: MutableTrafficRouteSample,
): MutableTrafficRouteSample {
  if (!Number.isFinite(distanceAlongRouteMillimeters)) {
    throw new RangeError('traffic-three:invalid-route-distance');
  }
  const target = Math.max(
    0,
    Math.min(prepared.totalLengthMillimeters, distanceAlongRouteMillimeters),
  );
  let low = 0;
  let high = prepared.segments.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (target <= prepared.cumulativeEndMillimeters[middle]!) high = middle;
    else low = middle + 1;
  }
  const segmentIndex = low;
  const segment = prepared.segments[segmentIndex]!;
  const previousEnd = segmentIndex === 0 ? 0 : prepared.cumulativeEndMillimeters[segmentIndex - 1]!;
  const segmentEnd = prepared.cumulativeEndMillimeters[segmentIndex]!;
  const segmentLength = Math.max(1, segmentEnd - previousEnd);
  const localDistance = Math.max(0, target - previousEnd);
  const localProgress = Math.max(0, Math.min(1, localDistance / segmentLength));
  positionBetweenInto(segment.from, segment.to, localProgress, outPosition);

  let heading = headingRadians(segment.from, segment.to);
  const next = prepared.segments[segmentIndex + 1];
  const distanceToEnd = segmentLength - localDistance;
  if (next !== undefined && distanceToEnd < TURN_SMOOTHING_MILLIMETERS) {
    const turnWeight =
      (TURN_SMOOTHING_MILLIMETERS - Math.max(0, distanceToEnd)) / TURN_SMOOTHING_MILLIMETERS;
    heading = blendHeadings(
      heading,
      headingRadians(next.from, next.to),
      Math.max(0, Math.min(1, turnWeight)),
    );
  }
  const sample = outSample ?? { headingRadians: heading, segmentIndex };
  sample.headingRadians = heading;
  sample.segmentIndex = segmentIndex;
  return sample;
}

export function worldPointFromQ(point: TrafficWorldPointQ): Vector3 {
  return new Vector3(
    point.xQ / WORLD_Q_PER_METER,
    point.yQ / WORLD_Q_PER_METER,
    point.zQ / WORLD_Q_PER_METER,
  );
}

export function sampleRouteEdgePosition(
  from: TrafficWorldPointQ,
  to: TrafficWorldPointQ,
  progressQ: number,
): Vector3 {
  const clamped = Math.max(0, Math.min(TRAFFIC_PROGRESS_MAX_Q, Math.trunc(progressQ)));
  const position = new Vector3();
  positionBetweenInto(from, to, clamped / TRAFFIC_PROGRESS_MAX_Q, position);
  return position;
}

export function sampleRoutePolyline(
  route: readonly TrafficRouteSegment[],
  distanceAlongRouteMillimeters: number,
): TrafficRouteSample {
  const prepared = prepareTrafficRoute(route);
  const position = new Vector3();
  const sample = samplePreparedRouteInto(prepared, distanceAlongRouteMillimeters, position);
  return Object.freeze({
    position,
    headingRadians: sample.headingRadians,
    segmentIndex: sample.segmentIndex,
  });
}

export function sampleSmoothTurn(
  previous: TrafficWorldPointQ,
  corner: TrafficWorldPointQ,
  next: TrafficWorldPointQ,
  turnProgressQ: number,
): Vector3 {
  const clamped = Math.max(0, Math.min(TRAFFIC_PROGRESS_MAX_Q, Math.trunc(turnProgressQ)));
  const t = clamped / TRAFFIC_PROGRESS_MAX_Q;
  const oneMinusT = 1 - t;
  return new Vector3(
    (oneMinusT * oneMinusT * previous.xQ + 2 * oneMinusT * t * corner.xQ + t * t * next.xQ) /
      WORLD_Q_PER_METER,
    (oneMinusT * oneMinusT * previous.yQ + 2 * oneMinusT * t * corner.yQ + t * t * next.yQ) /
      WORLD_Q_PER_METER,
    (oneMinusT * oneMinusT * previous.zQ + 2 * oneMinusT * t * corner.zQ + t * t * next.zQ) /
      WORLD_Q_PER_METER,
  );
}

export function headingRadians(from: TrafficWorldPointQ, to: TrafficWorldPointQ): number {
  return Math.atan2(to.xQ - from.xQ, to.zQ - from.zQ);
}
