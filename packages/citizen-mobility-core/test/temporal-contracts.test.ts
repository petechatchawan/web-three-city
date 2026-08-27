import { describe, expectTypeOf, it } from 'vitest';
import type { AbsoluteGameMinute } from '@web-three-city/simulation-core';
import type {
  CitizenMobilityState,
  DueMobilityBoundary,
  MobilityTrip,
  MobilityTripPlanningRequest,
} from '../src/index.js';

describe('Mobility temporal contracts', () => {
  it('uses explicit absolute game-minute points for schedule boundaries and trips', () => {
    expectTypeOf<
      NonNullable<CitizenMobilityState['nextBoundaryGameMinute']>
    >().toEqualTypeOf<AbsoluteGameMinute>();
    expectTypeOf<MobilityTrip['departureGameMinute']>().toEqualTypeOf<AbsoluteGameMinute>();
    expectTypeOf<
      MobilityTripPlanningRequest['departureGameMinute']
    >().toEqualTypeOf<AbsoluteGameMinute>();
    expectTypeOf<DueMobilityBoundary['atGameMinute']>().toEqualTypeOf<AbsoluteGameMinute>();
  });

  it('names the persisted schedule cursor as a simulation-cycle counter', () => {
    expectTypeOf<CitizenMobilityState['scheduleCursorCycle']>().toEqualTypeOf<number>();
  });
});
