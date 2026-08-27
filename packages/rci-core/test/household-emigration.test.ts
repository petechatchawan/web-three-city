import { describe, expect, it } from 'vitest';
import { planEmigrateHousehold } from '../src/index.js';
import { residentHouseholdSnapshot } from './housing-fixtures.js';

describe('Household emigration', () => {
  it('moves every resident to history and dissolves the Household atomically', () => {
    const result = planEmigrateHousehold({
      snapshot: residentHouseholdSnapshot(),
      householdId: 'household:1',
      evaluationMacroHourIndex: macroHour(100),
      endReasonDefinitionId: 'household-membership-ended.household-emigrated',
    });
    expect(result.population.citizens[0]).toMatchObject({
      presence: 'emigrated',
      movedOutOfCityAtMacroHourIndex: macroHour(100),
    });
    expect(result.households.memberships[0]?.endedAtMacroHourIndex).toBe(100);
    expect(result.households.households[0]?.dissolvedAtMacroHourIndex).toBe(100);
    expect(result.population.citizens).toHaveLength(1);
  });
});
import { macroHour } from './temporal-fixtures.js';
