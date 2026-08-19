import { TRAFFIC_PROGRESS_MAX_Q } from '@web-three-city/traffic-core';

export interface VehicleVisualPlacementInput {
  readonly tripId: string;
  readonly edgeId: string;
  readonly progressQ: number;
  readonly edgeLengthMillimeters: number;
  readonly queued: boolean;
}

export interface VehicleVisualPlacement {
  readonly tripId: string;
  readonly edgeId: string;
  readonly distanceAlongEdgeMillimeters: number;
  readonly adjustedProgressQ: number;
  readonly queued: boolean;
  readonly lateralOffsetMillimeters: number;
}

export interface VehicleRouteHeadwaySegment {
  readonly edgeId: string;
  readonly lengthMillimeters: number;
}

export interface VehicleRouteHeadwayInput {
  readonly tripId: string;
  readonly routeSegments: readonly VehicleRouteHeadwaySegment[];
  readonly routeDistanceMillimeters: number;
  readonly queued: boolean;
}

export interface VehicleRouteHeadwayPlacement {
  readonly tripId: string;
  readonly adjustedRouteDistanceMillimeters: number;
  readonly queued: boolean;
  readonly materialized: boolean;
}

interface RouteSegmentSpan {
  readonly edgeId: string;
  readonly startDistanceMillimeters: number;
  readonly endDistanceMillimeters: number;
}

interface RouteLayout {
  readonly spans: readonly RouteSegmentSpan[];
  readonly totalLengthMillimeters: number;
}

interface MutableRoutePlacement {
  readonly input: VehicleRouteHeadwayInput;
  readonly layout: RouteLayout;
  adjustedRouteDistanceMillimeters: number;
  materialized: boolean;
}

function compareInput(
  first: VehicleVisualPlacementInput,
  second: VehicleVisualPlacementInput,
): number {
  if (first.edgeId !== second.edgeId) return first.edgeId < second.edgeId ? -1 : 1;
  if (first.progressQ !== second.progressQ) return second.progressQ - first.progressQ;
  return first.tripId < second.tripId ? -1 : first.tripId > second.tripId ? 1 : 0;
}

function validateHeadway(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('traffic-three:invalid-headway');
  }
}

function routeLayoutFor(input: VehicleRouteHeadwayInput): RouteLayout {
  if (!Number.isFinite(input.routeDistanceMillimeters) || input.routeDistanceMillimeters < 0) {
    throw new RangeError('traffic-three:invalid-route-distance');
  }
  if (input.routeSegments.length === 0) {
    throw new RangeError('traffic-three:empty-route');
  }

  let totalLengthMillimeters = 0;
  const spans: RouteSegmentSpan[] = [];
  for (const segment of input.routeSegments) {
    if (!Number.isSafeInteger(segment.lengthMillimeters) || segment.lengthMillimeters <= 0) {
      throw new RangeError('traffic-three:invalid-edge-length');
    }
    const startDistanceMillimeters = totalLengthMillimeters;
    totalLengthMillimeters += segment.lengthMillimeters;
    spans.push(
      Object.freeze({
        edgeId: segment.edgeId,
        startDistanceMillimeters,
        endDistanceMillimeters: totalLengthMillimeters,
      }),
    );
  }
  return Object.freeze({
    spans: Object.freeze(spans),
    totalLengthMillimeters,
  });
}

function spanPositionAt(
  placement: MutableRoutePlacement,
): Readonly<{ edgeId: string; localDistanceMillimeters: number }> {
  const distance = Math.max(
    0,
    Math.min(placement.layout.totalLengthMillimeters, placement.adjustedRouteDistanceMillimeters),
  );
  for (let index = 0; index < placement.layout.spans.length; index += 1) {
    const span = placement.layout.spans[index]!;
    const isLast = index === placement.layout.spans.length - 1;
    if (distance < span.endDistanceMillimeters || isLast) {
      return Object.freeze({
        edgeId: span.edgeId,
        localDistanceMillimeters: Math.max(
          0,
          Math.min(
            span.endDistanceMillimeters - span.startDistanceMillimeters,
            distance - span.startDistanceMillimeters,
          ),
        ),
      });
    }
  }
  throw new Error('traffic-three:missing-route-span');
}

function mappedDistanceOnFollowerRoute(
  follower: MutableRoutePlacement,
  leader: MutableRoutePlacement,
): number | null {
  const leaderPosition = spanPositionAt(leader);
  let nearestAhead: number | null = null;
  for (const span of follower.layout.spans) {
    if (span.edgeId !== leaderPosition.edgeId) continue;
    const spanLength = span.endDistanceMillimeters - span.startDistanceMillimeters;
    const mapped =
      span.startDistanceMillimeters +
      Math.min(spanLength, Math.max(0, leaderPosition.localDistanceMillimeters));
    if (mapped < follower.adjustedRouteDistanceMillimeters) continue;
    if (nearestAhead === null || mapped < nearestAhead) nearestAhead = mapped;
  }
  return nearestAhead;
}

export function deriveVehicleVisualPlacements(
  inputs: readonly VehicleVisualPlacementInput[],
  minimumHeadwayMillimeters: number,
): readonly VehicleVisualPlacement[] {
  validateHeadway(minimumHeadwayMillimeters);
  const sorted = [...inputs].sort(compareInput);
  const lastDistanceByEdge = new Map<string, number>();
  const placements: VehicleVisualPlacement[] = [];

  for (const input of sorted) {
    if (
      !Number.isSafeInteger(input.progressQ) ||
      input.progressQ < 0 ||
      input.progressQ > TRAFFIC_PROGRESS_MAX_Q
    ) {
      throw new RangeError('traffic-three:invalid-progress');
    }
    if (!Number.isSafeInteger(input.edgeLengthMillimeters) || input.edgeLengthMillimeters <= 0) {
      throw new RangeError('traffic-three:invalid-edge-length');
    }
    const authoritativeDistance = Math.floor(
      (input.progressQ * input.edgeLengthMillimeters) / TRAFFIC_PROGRESS_MAX_Q,
    );
    const previousDistance = lastDistanceByEdge.get(input.edgeId);
    const distance =
      previousDistance === undefined
        ? authoritativeDistance
        : Math.max(
            0,
            Math.min(authoritativeDistance, previousDistance - minimumHeadwayMillimeters),
          );
    lastDistanceByEdge.set(input.edgeId, distance);
    placements.push(
      Object.freeze({
        tripId: input.tripId,
        edgeId: input.edgeId,
        distanceAlongEdgeMillimeters: distance,
        adjustedProgressQ: Math.min(
          TRAFFIC_PROGRESS_MAX_Q,
          Math.max(
            0,
            Math.floor((distance * TRAFFIC_PROGRESS_MAX_Q) / input.edgeLengthMillimeters),
          ),
        ),
        queued: input.queued,
        lateralOffsetMillimeters: 0,
      }),
    );
  }
  return Object.freeze(placements);
}

export function deriveVehicleRouteHeadwayPlacements(
  inputs: readonly VehicleRouteHeadwayInput[],
  minimumHeadwayMillimeters: number,
): readonly VehicleRouteHeadwayPlacement[] {
  validateHeadway(minimumHeadwayMillimeters);
  const states: MutableRoutePlacement[] = inputs.map((input) => {
    const layout = routeLayoutFor(input);
    return {
      input,
      layout,
      adjustedRouteDistanceMillimeters: Math.max(
        0,
        Math.min(layout.totalLengthMillimeters, input.routeDistanceMillimeters),
      ),
      materialized: true,
    };
  });

  for (let pass = 0; pass < Math.max(1, states.length); pass += 1) {
    let changed = false;
    for (const follower of states) {
      if (!follower.materialized) continue;
      let nextDistance = follower.adjustedRouteDistanceMillimeters;
      let materialized = true;

      for (const leader of states) {
        if (leader === follower || !leader.materialized) continue;
        const mappedLeaderDistance = mappedDistanceOnFollowerRoute(follower, leader);
        if (mappedLeaderDistance === null) continue;
        const gap = mappedLeaderDistance - follower.adjustedRouteDistanceMillimeters;
        if (gap < 0 || gap >= minimumHeadwayMillimeters) continue;
        if (gap === 0 && leader.input.tripId > follower.input.tripId) continue;

        const allowedDistance = mappedLeaderDistance - minimumHeadwayMillimeters;
        if (allowedDistance < 0) {
          materialized = false;
          break;
        }
        nextDistance = Math.min(nextDistance, allowedDistance);
      }

      if (!materialized) {
        follower.materialized = false;
        changed = true;
        continue;
      }
      if (nextDistance < follower.adjustedRouteDistanceMillimeters) {
        follower.adjustedRouteDistanceMillimeters = nextDistance;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return Object.freeze(
    states.map((state) =>
      Object.freeze({
        tripId: state.input.tripId,
        adjustedRouteDistanceMillimeters: state.adjustedRouteDistanceMillimeters,
        queued: state.input.queued,
        materialized: state.materialized,
      }),
    ),
  );
}
