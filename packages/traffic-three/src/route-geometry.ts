import { TRAFFIC_PROGRESS_MAX_Q } from '@web-three-city/traffic-core';
import { Vector3 } from 'three';

export interface TrafficWorldPointQ {
  readonly xQ: number;
  readonly yQ: number;
  readonly zQ: number;
}

const WORLD_Q_PER_METER = 1_000;

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
