import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_HOUSING_EMIGRATION_FACTORS,
  evaluateHouseholdEmigrationPressure,
} from '../src/index.js';

const neutral = {
  displaced: false,
  daysDisplaced: 0,
  overcrowdedMembers: 0,
  overcrowdingDurationDays: 0,
  unemployedMembers: 0,
  unemploymentDurationDays: 0,
  noCompatibleVacancies: false,
  underemployedMembers: 0,
} as const;

describe('housing emigration pressure', () => {
  it('is fixed-point, bounded, and insensitive to factor input order', () => {
    expect(
      evaluateHouseholdEmigrationPressure(neutral, FOUNDATION_HOUSING_EMIGRATION_FACTORS),
    ).toBe(0);
    const stressed = { ...neutral, displaced: true, daysDisplaced: 30, overcrowdedMembers: 2 };
    const first = evaluateHouseholdEmigrationPressure(
      stressed,
      FOUNDATION_HOUSING_EMIGRATION_FACTORS,
    );
    const second = evaluateHouseholdEmigrationPressure(
      stressed,
      [...FOUNDATION_HOUSING_EMIGRATION_FACTORS].reverse(),
    );
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(100_000);
  });
});
