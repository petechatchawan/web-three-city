import {
  createIntersectionLaneConnector,
  type IntersectionLaneConnector,
  type IntersectionLaneTurn,
} from './intersection-lane-connector.js';
import type { TrafficRouteSegment, TrafficWorldPointQ } from './route-geometry.js';

export type TrafficHandedness = 'left' | 'right';

// Presentation handedness only; canonical Traffic routing remains edge-based.
export const FOUNDATION_TRAFFIC_HANDEDNESS: TrafficHandedness = 'left';

export interface DirectedLanePathSegment extends TrafficRouteSegment {
  readonly sourceEdgeId: string;
  readonly kind: 'lane' | 'connector';
  readonly lengthMillimeters: number;
}

export interface DirectedLanePathEdgeSpan {
  readonly sourceEdgeId: string;
  readonly startDistanceMillimeters: number;
  readonly endDistanceMillimeters: number;
}

export interface DirectedLanePathTurn {
  readonly junctionIndex: number;
  readonly turn: IntersectionLaneTurn;
}

export interface DirectedLanePath {
  readonly segments: readonly DirectedLanePathSegment[];
  readonly edgeSpans: readonly DirectedLanePathEdgeSpan[];
  readonly turns: readonly DirectedLanePathTurn[];
}

interface MutableLaneSegment {
  readonly sourceEdgeId: string;
  from: TrafficWorldPointQ;
  to: TrafficWorldPointQ;
}

interface Direction2 {
  readonly x: number;
  readonly z: number;
  readonly length: number;
}

function horizontalDirection(segment: TrafficRouteSegment): Direction2 {
  const dx = segment.to.xQ - segment.from.xQ;
  const dz = segment.to.zQ - segment.from.zQ;
  const length = Math.hypot(dx, dz);
  if (length <= 0) throw new RangeError('traffic-three:invalid-lane-segment');
  return Object.freeze({ x: dx / length, z: dz / length, length });
}

function validateLaneOffsetQ(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('traffic-three:invalid-lane-offset');
  }
}

export function deriveDirectedLaneSegment(
  segment: TrafficRouteSegment,
  options: Readonly<{
    laneOffsetQ: number;
    handedness?: TrafficHandedness;
  }>,
): TrafficRouteSegment {
  validateLaneOffsetQ(options.laneOffsetQ);
  const direction = horizontalDirection(segment);
  const handedness = options.handedness ?? FOUNDATION_TRAFFIC_HANDEDNESS;
  if (handedness !== 'left' && handedness !== 'right') {
    throw new RangeError('traffic-three:invalid-handedness');
  }
  const sign = handedness === 'left' ? 1 : -1;
  const offsetX = direction.z * options.laneOffsetQ * sign;
  const offsetZ = -direction.x * options.laneOffsetQ * sign;
  const translate = (value: TrafficWorldPointQ): TrafficWorldPointQ =>
    Object.freeze({
      xQ: Math.round(value.xQ + offsetX),
      yQ: value.yQ,
      zQ: Math.round(value.zQ + offsetZ),
    });
  return Object.freeze({
    ...segment,
    from: translate(segment.from),
    to: translate(segment.to),
  });
}

function samePoint(first: TrafficWorldPointQ, second: TrafficWorldPointQ): boolean {
  return first.xQ === second.xQ && first.yQ === second.yQ && first.zQ === second.zQ;
}

function pointAlongHorizontalSegment(
  segment: Readonly<{ from: TrafficWorldPointQ; to: TrafficWorldPointQ }>,
  distanceFromStartQ: number,
): TrafficWorldPointQ {
  const dx = segment.to.xQ - segment.from.xQ;
  const dz = segment.to.zQ - segment.from.zQ;
  const horizontalLength = Math.hypot(dx, dz);
  if (horizontalLength <= 0) throw new RangeError('traffic-three:invalid-lane-segment');
  const ratio = Math.max(0, Math.min(1, distanceFromStartQ / horizontalLength));
  return Object.freeze({
    xQ: Math.round(segment.from.xQ + (segment.to.xQ - segment.from.xQ) * ratio),
    yQ: Math.round(segment.from.yQ + (segment.to.yQ - segment.from.yQ) * ratio),
    zQ: Math.round(segment.from.zQ + (segment.to.zQ - segment.from.zQ) * ratio),
  });
}

function segmentLengthMillimeters(from: TrafficWorldPointQ, to: TrafficWorldPointQ): number {
  return Math.max(1, Math.ceil(Math.hypot(to.xQ - from.xQ, to.yQ - from.yQ, to.zQ - from.zQ)));
}

function laneSegment(segment: MutableLaneSegment): DirectedLanePathSegment {
  return Object.freeze({
    edgeId: `lane:${segment.sourceEdgeId}:${segment.from.xQ},${segment.from.yQ},${segment.from.zQ}->${segment.to.xQ},${segment.to.yQ},${segment.to.zQ}`,
    sourceEdgeId: segment.sourceEdgeId,
    kind: 'lane' as const,
    from: segment.from,
    to: segment.to,
    lengthMillimeters: segmentLengthMillimeters(segment.from, segment.to),
  });
}

function edgeSpansFor(
  route: readonly TrafficRouteSegment[],
  segments: readonly DirectedLanePathSegment[],
): readonly DirectedLanePathEdgeSpan[] {
  const mutable = new Map<
    string,
    { sourceEdgeId: string; startDistanceMillimeters: number; endDistanceMillimeters: number }
  >();
  let distance = 0;
  for (const segment of segments) {
    const start = distance;
    distance += segment.lengthMillimeters;
    const existing = mutable.get(segment.sourceEdgeId);
    if (existing === undefined) {
      mutable.set(segment.sourceEdgeId, {
        sourceEdgeId: segment.sourceEdgeId,
        startDistanceMillimeters: start,
        endDistanceMillimeters: distance,
      });
    } else {
      existing.endDistanceMillimeters = distance;
    }
  }
  return Object.freeze(
    route.map((segment) => {
      const span = mutable.get(segment.edgeId);
      if (span === undefined) throw new Error('traffic-three:missing-lane-edge-span');
      return Object.freeze({ ...span });
    }),
  );
}

export function deriveDirectedLanePath(
  route: readonly TrafficRouteSegment[],
  options: Readonly<{
    laneOffsetsQ: readonly number[];
    handedness?: TrafficHandedness;
    junctionHalfExtentQ?: number;
    connectorSampleCount?: number;
  }>,
): DirectedLanePath {
  if (route.length === 0) {
    return Object.freeze({
      segments: Object.freeze([]),
      edgeSpans: Object.freeze([]),
      turns: Object.freeze([]),
    });
  }
  if (options.laneOffsetsQ.length !== route.length) {
    throw new RangeError('traffic-three:lane-offset-count-mismatch');
  }
  const junctionHalfExtentQ = options.junctionHalfExtentQ ?? 400;
  if (!Number.isSafeInteger(junctionHalfExtentQ) || junctionHalfExtentQ <= 0) {
    throw new RangeError('traffic-three:invalid-junction-envelope');
  }
  const laneSegments: MutableLaneSegment[] = route.map((segment, index) => {
    const laneOffsetQ = options.laneOffsetsQ[index]!;
    validateLaneOffsetQ(laneOffsetQ);
    const directed = deriveDirectedLaneSegment(segment, {
      laneOffsetQ,
      ...(options.handedness === undefined ? {} : { handedness: options.handedness }),
    });
    return {
      sourceEdgeId: segment.edgeId,
      from: directed.from,
      to: directed.to,
    };
  });
  const connectors = new Map<number, IntersectionLaneConnector>();
  const turns: DirectedLanePathTurn[] = [];
  for (let index = 0; index < route.length - 1; index += 1) {
    const currentCenter = route[index]!;
    const nextCenter = route[index + 1]!;
    if (!samePoint(currentCenter.to, nextCenter.from)) {
      throw new RangeError('traffic-three:disconnected-route');
    }
    if (
      options.laneOffsetsQ[index]! >= junctionHalfExtentQ ||
      options.laneOffsetsQ[index + 1]! >= junctionHalfExtentQ
    ) {
      throw new RangeError('traffic-three:lane-outside-junction-envelope');
    }
    const currentDirection = horizontalDirection(currentCenter);
    const nextDirection = horizontalDirection(nextCenter);
    if (
      currentDirection.length <= junctionHalfExtentQ * 2 ||
      nextDirection.length <= junctionHalfExtentQ * 2
    ) {
      throw new RangeError('traffic-three:junction-envelope-too-large');
    }
    const current = laneSegments[index]!;
    const next = laneSegments[index + 1]!;
    current.to = pointAlongHorizontalSegment(
      current,
      currentDirection.length - junctionHalfExtentQ,
    );
    next.from = pointAlongHorizontalSegment(next, junctionHalfExtentQ);
    const connector = createIntersectionLaneConnector({
      incoming: {
        edgeId: current.sourceEdgeId,
        from: current.from,
        to: current.to,
      },
      outgoing: {
        edgeId: next.sourceEdgeId,
        from: next.from,
        to: next.to,
      },
      incomingSourceEdgeId: current.sourceEdgeId,
      outgoingSourceEdgeId: next.sourceEdgeId,
      ...(options.connectorSampleCount === undefined
        ? {}
        : { sampleCount: options.connectorSampleCount }),
    });
    connectors.set(index, connector);
    turns.push(Object.freeze({ junctionIndex: index, turn: connector.turn }));
  }
  const segments: DirectedLanePathSegment[] = [];
  for (let index = 0; index < laneSegments.length; index += 1) {
    segments.push(laneSegment(laneSegments[index]!));
    const connector = connectors.get(index);
    if (connector !== undefined) segments.push(...connector.segments);
  }
  const frozenSegments = Object.freeze(segments);
  return Object.freeze({
    segments: frozenSegments,
    edgeSpans: edgeSpansFor(route, frozenSegments),
    turns: Object.freeze(turns),
  });
}
