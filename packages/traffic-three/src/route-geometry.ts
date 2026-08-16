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
  /** Optional cached length in millimetres; omitted values are derived once per sample. */
  readonly lengthMillimeters?: number;
}

export interface TrafficRouteSample {
  readonly position: Vector3;
  readonly headingRadians: number;
  readonly segmentIndex: number;
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
  const t = clamped / TRAFFIC_PROGRESS_MAX_Q;
  return worldPointFromQ(from).lerp(worldPointFromQ(to), t);
}

/**
 * Samples a rendered route by distance along its existing edge polyline.
 * This is presentation-only: it consumes route geometry and never changes trip progress.
 */
export function sampleRoutePolyline(
  route: readonly TrafficRouteSegment[],
  distanceAlongRouteMillimeters: number,
): TrafficRouteSample {
  if (route.length === 0) throw new RangeError('traffic-three:empty-route');
  if (!Number.isFinite(distanceAlongRouteMillimeters)) {
    throw new RangeError('traffic-three:invalid-route-distance');
  }
  let totalLength = 0;
  for (const segment of route) totalLength += routeSegmentLengthMillimeters(segment);
  let remaining = Math.max(0, Math.min(totalLength, distanceAlongRouteMillimeters));
  let segmentIndex = route.length - 1;
  let segmentLength = routeSegmentLengthMillimeters(route[route.length - 1]!);
  for (let index = 0; index < route.length; index += 1) {
    const length = routeSegmentLengthMillimeters(route[index]!);
    if (remaining <= length || index === route.length - 1) {
      segmentIndex = index;
      segmentLength = length;
      break;
    }
    remaining -= length;
  }

  const segment = route[segmentIndex]!;
  const progressQ = Math.round((remaining * TRAFFIC_PROGRESS_MAX_Q) / segmentLength);
  const position = sampleRouteEdgePosition(segment.from, segment.to, progressQ);
  let heading = headingRadians(segment.from, segment.to);
  const next = route[segmentIndex + 1];
  if (next !== undefined && segmentLength - remaining < TURN_SMOOTHING_MILLIMETERS) {
    const turnWeight =
      (TURN_SMOOTHING_MILLIMETERS - Math.max(0, segmentLength - remaining)) /
      TURN_SMOOTHING_MILLIMETERS;
    heading = blendHeadings(
      heading,
      headingRadians(next.from, next.to),
      Math.max(0, Math.min(1, turnWeight)),
    );
  }
  return Object.freeze({ position, headingRadians: heading, segmentIndex });
}

export function sampleSmoothTurn(
  previous: TrafficWorldPointQ,
  corner: TrafficWorldPointQ,
  next: TrafficWorldPointQ,
  turnProgressQ: number,
): Vector3 {
  const clamped = Math.max(0, Math.min(TRAFFIC_PROGRESS_MAX_Q, Math.trunc(turnProgressQ)));
  const t = clamped / TRAFFIC_PROGRESS_MAX_Q;
  const p0 = worldPointFromQ(previous);
  const p1 = worldPointFromQ(corner);
  const p2 = worldPointFromQ(next);
  const oneMinusT = 1 - t;
  return new Vector3(
    oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
    oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * t * p1.z + t * t * p2.z,
  );
}

export function headingRadians(from: TrafficWorldPointQ, to: TrafficWorldPointQ): number {
  return Math.atan2(to.xQ - from.xQ, to.zQ - from.zQ);
}
