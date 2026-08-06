import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_EMPLOYMENT_EMIGRATION_FACTORS,
  evaluateHouseholdEmigrationPressure,
} from '../src/index.js';

describe('Employment emigration pressure', () => {
  it('extends the shared stable fixed-point factor contract', () => {
    const context = {
      displaced: false,
      daysDisplaced: 0,
      overcrowdedMembers: 0,
      overcrowdingDurationDays: 0,
      unemployedMembers: 2,
      unemploymentDurationDays: 30,
      noCompatibleVacancies: true,
      underemployedMembers: 1,
    } as const;
    const forward = evaluateHouseholdEmigrationPressure(
      context,
      FOUNDATION_EMPLOYMENT_EMIGRATION_FACTORS,
    );
    const reverse = evaluateHouseholdEmigrationPressure(
      context,
      [...FOUNDATION_EMPLOYMENT_EMIGRATION_FACTORS].reverse(),
    );
    expect(forward).toBe(reverse);
    expect(forward).toBeGreaterThan(0);
    expect(forward).toBeLessThanOrEqual(100_000);
  });
});
