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

const LATERAL_OFFSETS_MILLIMETERS = Object.freeze([0, 1_700, -1_700, 2_600, -2_600]);

function compareInput(
  first: VehicleVisualPlacementInput,
  second: VehicleVisualPlacementInput,
): number {
  if (first.edgeId !== second.edgeId) return first.edgeId < second.edgeId ? -1 : 1;
  if (first.progressQ !== second.progressQ) return second.progressQ - first.progressQ;
  return first.tripId < second.tripId ? -1 : first.tripId > second.tripId ? 1 : 0;
}

export function deriveVehicleVisualPlacements(
  inputs: readonly VehicleVisualPlacementInput[],
  minimumHeadwayMillimeters: number,
): readonly VehicleVisualPlacement[] {
  if (!Number.isFinite(minimumHeadwayMillimeters) || minimumHeadwayMillimeters < 0) {
    throw new RangeError('traffic-three:invalid-headway');
  }
  const sorted = [...inputs].sort(compareInput);
  const lastDistanceByEdge = new Map<string, number>();
  const orderByEdge = new Map<string, number>();
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
    const orderOnEdge = orderByEdge.get(input.edgeId) ?? 0;
    orderByEdge.set(input.edgeId, orderOnEdge + 1);
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
        lateralOffsetMillimeters:
          LATERAL_OFFSETS_MILLIMETERS[orderOnEdge % LATERAL_OFFSETS_MILLIMETERS.length]!,
      }),
    );
  }
  return Object.freeze(placements);
}
