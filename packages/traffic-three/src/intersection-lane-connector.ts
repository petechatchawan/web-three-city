import {
  prepareTrafficCubicArcLength,
  splitTrafficCubicCurveHalf,
  type TrafficCubicCurveQ,
} from './cubic-motion-curve.js';
import type { TrafficRouteSegment } from './route-geometry.js';

export type IntersectionLaneTurn = 'straight' | 'left' | 'right';
export type IntersectionLaneMovementKind = 'straight' | 'turn-left' | 'turn-right';

export interface IntersectionLaneConnectorSegment extends TrafficRouteSegment {
  readonly sourceEdgeId: string;
  readonly kind: 'connector';
  readonly movementKind: IntersectionLaneMovementKind;
  readonly curve: TrafficCubicCurveQ;
  readonly lengthMillimeters: number;
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

function movementKindFor(turn: IntersectionLaneTurn): IntersectionLaneMovementKind {
  return turn === 'left' ? 'turn-left' : turn === 'right' ? 'turn-right' : 'straight';
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
  const movementKind = movementKindFor(turn);
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
  const curve: TrafficCubicCurveQ = Object.freeze({
    p0: start,
    p1: controlOne,
    p2: controlTwo,
    p3: end,
  });
  const [incomingHalf, outgoingHalf] = splitTrafficCubicCurveHalf(curve);
  const arcSampleCount = Math.max(4, sampleCount);
  const segments: readonly IntersectionLaneConnectorSegment[] = Object.freeze([
    Object.freeze({
      edgeId: `lane-connector:${input.incomingSourceEdgeId}->${input.outgoingSourceEdgeId}:incoming`,
      sourceEdgeId: input.incomingSourceEdgeId,
      kind: 'connector' as const,
      movementKind,
      curve: incomingHalf,
      from: incomingHalf.p0,
      to: incomingHalf.p3,
      lengthMillimeters: prepareTrafficCubicArcLength(incomingHalf, arcSampleCount)
        .totalLengthMillimeters,
    }),
    Object.freeze({
      edgeId: `lane-connector:${input.incomingSourceEdgeId}->${input.outgoingSourceEdgeId}:outgoing`,
      sourceEdgeId: input.outgoingSourceEdgeId,
      kind: 'connector' as const,
      movementKind,
      curve: outgoingHalf,
      from: outgoingHalf.p0,
      to: outgoingHalf.p3,
      lengthMillimeters: prepareTrafficCubicArcLength(outgoingHalf, arcSampleCount)
        .totalLengthMillimeters,
    }),
  ]);
  return Object.freeze({ turn, segments });
}
