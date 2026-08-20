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

export interface VehicleRouteVisualHeadwayInput {
  readonly tripId: string;
  readonly routeSegments: readonly VehicleRouteHeadwaySegment[];
  readonly visualDistanceMillimeters: number;
}

export interface VehicleRouteVisualHeadwayConstraint {
  readonly tripId: string;
  readonly leaderTripId: string | null;
  readonly maximumVisualDistanceMillimeters: number | null;
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

interface SpacingCoordinate {
  readonly laneKey: string;
  readonly longitudinalMillimeters: number;
  readonly scaleMillimeters: number;
}

interface PreparedVisualPlacementInput {
  readonly input: VehicleVisualPlacementInput;
  readonly coordinate: SpacingCoordinate;
}

const RENDERED_ROAD_CELL_MILLIMETERS = 1_000;
const DRIVE_EDGE_PATTERN = /^drive:(-?\d+),(-?\d+)->(-?\d+),(-?\d+)$/;

function validateHeadway(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('traffic-three:invalid-headway');
  }
}

function validateVisualInput(input: VehicleVisualPlacementInput): void {
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
}

function spacingCoordinateFor(input: VehicleVisualPlacementInput): SpacingCoordinate {
  const match = DRIVE_EDGE_PATTERN.exec(input.edgeId);
  if (match === null) {
    return Object.freeze({
      laneKey: `edge:${input.edgeId}`,
      longitudinalMillimeters: Math.floor(
        (input.progressQ * input.edgeLengthMillimeters) / TRAFFIC_PROGRESS_MAX_Q,
      ),
      scaleMillimeters: input.edgeLengthMillimeters,
    });
  }

  const fromX = Number(match[1]);
  const fromZ = Number(match[2]);
  const toX = Number(match[3]);
  const toZ = Number(match[4]);
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const localDistance = (input.progressQ * RENDERED_ROAD_CELL_MILLIMETERS) / TRAFFIC_PROGRESS_MAX_Q;

  if (dx === 1 && dz === 0) {
    return Object.freeze({
      laneKey: `drive:east:${fromZ}`,
      longitudinalMillimeters: fromX * RENDERED_ROAD_CELL_MILLIMETERS + localDistance,
      scaleMillimeters: RENDERED_ROAD_CELL_MILLIMETERS,
    });
  }
  if (dx === -1 && dz === 0) {
    return Object.freeze({
      laneKey: `drive:west:${fromZ}`,
      longitudinalMillimeters: -fromX * RENDERED_ROAD_CELL_MILLIMETERS + localDistance,
      scaleMillimeters: RENDERED_ROAD_CELL_MILLIMETERS,
    });
  }
  if (dx === 0 && dz === 1) {
    return Object.freeze({
      laneKey: `drive:south:${fromX}`,
      longitudinalMillimeters: fromZ * RENDERED_ROAD_CELL_MILLIMETERS + localDistance,
      scaleMillimeters: RENDERED_ROAD_CELL_MILLIMETERS,
    });
  }
  if (dx === 0 && dz === -1) {
    return Object.freeze({
      laneKey: `drive:north:${fromX}`,
      longitudinalMillimeters: -fromZ * RENDERED_ROAD_CELL_MILLIMETERS + localDistance,
      scaleMillimeters: RENDERED_ROAD_CELL_MILLIMETERS,
    });
  }

  return Object.freeze({
    laneKey: `edge:${input.edgeId}`,
    longitudinalMillimeters: Math.floor(
      (input.progressQ * input.edgeLengthMillimeters) / TRAFFIC_PROGRESS_MAX_Q,
    ),
    scaleMillimeters: input.edgeLengthMillimeters,
  });
}

function comparePreparedInput(
  first: PreparedVisualPlacementInput,
  second: PreparedVisualPlacementInput,
): number {
  if (first.coordinate.laneKey !== second.coordinate.laneKey) {
    return first.coordinate.laneKey < second.coordinate.laneKey ? -1 : 1;
  }
  if (first.coordinate.longitudinalMillimeters !== second.coordinate.longitudinalMillimeters) {
    return second.coordinate.longitudinalMillimeters - first.coordinate.longitudinalMillimeters;
  }
  return first.input.tripId < second.input.tripId
    ? -1
    : first.input.tripId > second.input.tripId
      ? 1
      : 0;
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

function authoritativeLeaderAtTie(
  leader: MutableRoutePlacement,
  follower: MutableRoutePlacement,
): boolean {
  if (leader.input.routeDistanceMillimeters !== follower.input.routeDistanceMillimeters) {
    return leader.input.routeDistanceMillimeters > follower.input.routeDistanceMillimeters;
  }
  return leader.input.tripId < follower.input.tripId;
}

function routePlacementForVisualHeadway(
  input: VehicleRouteVisualHeadwayInput,
): MutableRoutePlacement {
  const routeInput: VehicleRouteHeadwayInput = Object.freeze({
    tripId: input.tripId,
    routeSegments: input.routeSegments,
    routeDistanceMillimeters: input.visualDistanceMillimeters,
    queued: false,
  });
  const layout = routeLayoutFor(routeInput);
  return {
    input: routeInput,
    layout,
    adjustedRouteDistanceMillimeters: Math.max(
      0,
      Math.min(layout.totalLengthMillimeters, input.visualDistanceMillimeters),
    ),
    materialized: true,
  };
}

export function deriveVehicleVisualPlacements(
  inputs: readonly VehicleVisualPlacementInput[],
  minimumHeadwayMillimeters: number,
): readonly VehicleVisualPlacement[] {
  validateHeadway(minimumHeadwayMillimeters);
  const prepared = inputs.map((input) => {
    validateVisualInput(input);
    return Object.freeze({ input, coordinate: spacingCoordinateFor(input) });
  });
  prepared.sort(comparePreparedInput);
  const lastDistanceByLane = new Map<string, number>();
  const placements: VehicleVisualPlacement[] = [];

  for (const { input, coordinate } of prepared) {
    const previousDistance = lastDistanceByLane.get(coordinate.laneKey);
    const adjustedLongitudinalDistance =
      previousDistance === undefined
        ? coordinate.longitudinalMillimeters
        : Math.min(
            coordinate.longitudinalMillimeters,
            previousDistance - minimumHeadwayMillimeters,
          );
    lastDistanceByLane.set(coordinate.laneKey, adjustedLongitudinalDistance);
    const longitudinalDelta = adjustedLongitudinalDistance - coordinate.longitudinalMillimeters;
    const adjustedProgressQ = Math.min(
      TRAFFIC_PROGRESS_MAX_Q,
      Math.floor(
        input.progressQ +
          (longitudinalDelta * TRAFFIC_PROGRESS_MAX_Q) / coordinate.scaleMillimeters,
      ),
    );
    const distance = Math.floor(
      (adjustedProgressQ * input.edgeLengthMillimeters) / TRAFFIC_PROGRESS_MAX_Q,
    );
    placements.push(
      Object.freeze({
        tripId: input.tripId,
        edgeId: input.edgeId,
        distanceAlongEdgeMillimeters: distance,
        adjustedProgressQ,
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

export function deriveVehicleRouteVisualHeadwayConstraints(
  inputs: readonly VehicleRouteVisualHeadwayInput[],
  minimumHeadwayMillimeters: number,
): readonly VehicleRouteVisualHeadwayConstraint[] {
  validateHeadway(minimumHeadwayMillimeters);
  const states = inputs.map(routePlacementForVisualHeadway);

  return Object.freeze(
    states.map((follower) => {
      let leaderTripId: string | null = null;
      let nearestLeaderDistance: number | null = null;

      for (const leader of states) {
        if (leader === follower) continue;
        const mappedLeaderDistance = mappedDistanceOnFollowerRoute(follower, leader);
        if (mappedLeaderDistance === null) continue;
        const gap = mappedLeaderDistance - follower.adjustedRouteDistanceMillimeters;
        if (gap < 0) continue;
        if (gap === 0 && !authoritativeLeaderAtTie(leader, follower)) continue;
        if (
          nearestLeaderDistance === null ||
          mappedLeaderDistance < nearestLeaderDistance ||
          (mappedLeaderDistance === nearestLeaderDistance &&
            leaderTripId !== null &&
            leader.input.tripId < leaderTripId)
        ) {
          leaderTripId = leader.input.tripId;
          nearestLeaderDistance = mappedLeaderDistance;
        }
      }

      return Object.freeze({
        tripId: follower.input.tripId,
        leaderTripId,
        maximumVisualDistanceMillimeters:
          nearestLeaderDistance === null
            ? null
            : Math.max(0, nearestLeaderDistance - minimumHeadwayMillimeters),
      });
    }),
  );
}
