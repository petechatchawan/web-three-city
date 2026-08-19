import { describe, expect, it } from 'vitest';
import * as vehicleSpacing from '../src/vehicle-spacing.js';
import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  deriveVehicleVisualPlacements,
} from '../src/index.js';

describe('PR3 lane-owned vehicle spacing', () => {
  it('keeps same-direction vehicles on the derived lane centerline while retaining longitudinal headway', () => {
    const placements = deriveVehicleVisualPlacements(
      ['a', 'b', 'c'].map((tripId) => ({
        tripId,
        edgeId: 'shared-edge',
        progressQ: 500_000,
        edgeLengthMillimeters: 8_000,
        queued: false,
      })),
      1_000,
    );

    expect(placements.map((placement) => placement.lateralOffsetMillimeters)).toEqual([0, 0, 0]);
    expect(placements.map((placement) => placement.adjustedProgressQ)).toEqual([
      500_000, 375_000, 250_000,
    ]);
  });

  it('uses presentation-space headway that clears a vehicle without exceeding one rendered Road cell', () => {
    const vehicleLengthMillimeters =
      FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY.vehicleLengthWorldUnits * 1_000;

    expect(FOUNDATION_TRAFFIC_PRESENTATION_POLICY.vehicleMinimumHeadwayMillimeters).toBeGreaterThan(
      vehicleLengthMillimeters,
    );
    expect(FOUNDATION_TRAFFIC_PRESENTATION_POLICY.vehicleMinimumHeadwayMillimeters).toBeLessThan(
      1_000,
    );
  });

  it('retains headway across adjacent directed lane segments instead of resetting at an edge boundary', () => {
    const deriveRoutePlacements = Reflect.get(
      vehicleSpacing,
      'deriveVehicleRouteHeadwayPlacements',
    ) as unknown;
    expect(typeof deriveRoutePlacements).toBe('function');

    const first = Object.freeze({
      edgeId: 'lane:first',
      from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
      to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
      lengthMillimeters: 8_000,
    });
    const second = Object.freeze({
      edgeId: 'lane:second',
      from: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
      to: Object.freeze({ xQ: 16_000, yQ: 0, zQ: 0 }),
      lengthMillimeters: 8_000,
    });
    const route = Object.freeze([first, second]);
    const placements = (
      deriveRoutePlacements as (
        inputs: readonly Readonly<{
          tripId: string;
          routeSegments: typeof route;
          routeDistanceMillimeters: number;
          queued: boolean;
        }>[],
        minimumHeadwayMillimeters: number,
      ) => readonly Readonly<{
        tripId: string;
        adjustedRouteDistanceMillimeters: number;
        materialized: boolean;
      }>[]
    )(
      [
        {
          tripId: 'leader',
          routeSegments: route,
          routeDistanceMillimeters: 9_000,
          queued: false,
        },
        {
          tripId: 'middle',
          routeSegments: route,
          routeDistanceMillimeters: 7_500,
          queued: false,
        },
        {
          tripId: 'tail',
          routeSegments: route,
          routeDistanceMillimeters: 7_000,
          queued: false,
        },
      ],
      4_500,
    );
    const byTrip = new Map(placements.map((placement) => [placement.tripId, placement]));

    expect(byTrip.get('leader')).toMatchObject({
      adjustedRouteDistanceMillimeters: 9_000,
      materialized: true,
    });
    expect(byTrip.get('middle')).toMatchObject({
      adjustedRouteDistanceMillimeters: 4_500,
      materialized: true,
    });
    expect(byTrip.get('tail')).toMatchObject({ materialized: false });
  });
});
