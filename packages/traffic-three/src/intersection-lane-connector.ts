import type { TrafficRouteSegment, TrafficWorldPointQ } from './route-geometry.js';

export type IntersectionLaneTurn = 'straight' | 'left' | 'right';

export interface IntersectionLaneConnectorSegment extends TrafficRouteSegment {
  readonly sourceEdgeId: string;
  readonly kind: 'connector';
}

export interface IntersectionLaneConnector {
  readonly turn: IntersectionLaneTurn;
  readonly segments: readonly IntersectionLaneConnectorSegment[];
}

interface Direction2 {
  readonly x: number;
  readonly z: number;
}

function horizontalDirection(segment: TrafficRouteSegment): Direction2 {
  const dx = segment.to.xQ - segment.from.xQ;
  const dz = segment.to.zQ - segment.from.zQ;
  const length = Math.hypot(dx, dz);
  if (length <= 0) throw new RangeError('traffic-three:invalid-lane-segment');
  return Object.freeze({ x: dx / length, z: dz / length });
}

export function classifyIntersectionLaneTurn(
  incoming: TrafficRouteSegment,
  outgoing: TrafficRouteSegment,
): IntersectionLaneTurn {
  const from = horizontalDirection(incoming);
  const to = horizontalDirection(outgoing);
  const dot = from.x * to.x + from.z * to.z;
  if (dot < -0.999) throw new RangeError('traffic-three:u-turn-not-supported');
  if (dot > 0.999) return 'straight';
  const cross = from.x * to.z - from.z * to.x;
  return cross > 0 ? 'right' : 'left';
}

function point(
  p0: TrafficWorldPointQ,
  p1: TrafficWorldPointQ,
  p2: TrafficWorldPointQ,
  p3: TrafficWorldPointQ,
  t: number,
): TrafficWorldPointQ {
  const oneMinusT = 1 - t;
  const a = oneMinusT * oneMinusT * oneMinusT;
  const b = 3 * oneMinusT * oneMinusT * t;
  const c = 3 * oneMinusT * t * t;
  const d = t * t * t;
  return Object.freeze({
    xQ: Math.round(a * p0.xQ + b * p1.xQ + c * p2.xQ + d * p3.xQ),
    yQ: Math.round(a * p0.yQ + b * p1.yQ + c * p2.yQ + d * p3.yQ),
    zQ: Math.round(a * p0.zQ + b * p1.zQ + c * p2.zQ + d * p3.zQ),
  });
}

function segmentLengthMillimeters(
  from: TrafficWorldPointQ,
  to: TrafficWorldPointQ,
): number {
  return Math.max(
    1,
    Math.ceil(Math.hypot(to.xQ - from.xQ, to.yQ - from.yQ, to.zQ - from.zQ)),
  );
}

export function createIntersectionLaneConnector(
  input: Readonly<{
    incoming: TrafficRouteSegment;
    outgoing: TrafficRouteSegment;
    incomingSourceEdgeId: string;
    outgoingSourceEdgeId: string;
    sampleCount?: number;
  }>,
): IntersectionLaneConnector {
  const sampleCount = input.sampleCount ?? 4;
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 2 || sampleCount % 2 !== 0) {
    throw new RangeError('traffic-three:invalid-connector-sample-count');
  }
  const turn = classifyIntersectionLaneTurn(input.incoming, input.outgoing);
  const incomingDirection = horizontalDirection(input.incoming);
  const outgoingDirection = horizontalDirection(input.outgoing);
  const start = input.incoming.to;
  const end = input.outgoing.from;
  const chord = Math.hypot(end.xQ - start.xQ, end.zQ - start.zQ);
  const controlDistance = chord * 0.35;
  const controlOne = Object.freeze({
    xQ: Math.round(start.xQ + incomingDirection.x * controlDistance),
    yQ: start.yQ,
    zQ: Math.round(start.zQ + incomingDirection.z * controlDistance),
  });
  const controlTwo = Object.freeze({
    xQ: Math.round(end.xQ - outgoingDirection.x * controlDistance),
    yQ: end.yQ,
    zQ: Math.round(end.zQ - outgoingDirection.z * controlDistance),
  });
  const segments: IntersectionLaneConnectorSegment[] = [];
  let previous = start;
  for (let index = 0; index < sampleCount; index += 1) {
    const next = point(start, controlOne, controlTwo, end, (index + 1) / sampleCount);
    const sourceEdgeId =
      index < sampleCount / 2 ? input.incomingSourceEdgeId : input.outgoingSourceEdgeId;
    segments.push(
      Object.freeze({
        edgeId: `lane-connector:${input.incomingSourceEdgeId}->${input.outgoingSourceEdgeId}:${index}`,
        sourceEdgeId,
        kind: 'connector' as const,
        from: previous,
        to: next,
        lengthMillimeters: segmentLengthMillimeters(previous, next),
      }),
    );
    previous = next;
  }
  return Object.freeze({ turn, segments: Object.freeze(segments) });
}
