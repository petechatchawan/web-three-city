import { describe, expect, it } from 'vitest';
import { orderDisplacedHouseholds, planDisplaceHousehold } from '../src/index.js';
import { residentHouseholdSnapshot } from './housing-fixtures.js';

describe('displaced Household queue', () => {
  it('creates one entry with the exact 720-macroHourIndex expiry', () => {
    const displaced = planDisplaceHousehold({
      snapshot: residentHouseholdSnapshot(),
      householdId: 'household:1',
      displacedAtMacroHourIndex: macroHour(40),
    });
    expect(displaced.migration.displacedHouseholds).toEqual([
      expect.objectContaining({
        householdId: 'household:1',
        displacedAtMacroHourIndex: macroHour(40),
        expiresAtMacroHourIndex: macroHour(760),
        minimumResidentCapacity: 1,
      }),
    ]);
    expect(
      planDisplaceHousehold({
        snapshot: displaced,
        householdId: 'household:1',
        displacedAtMacroHourIndex: macroHour(41),
      }),
    ).toBe(displaced);
  });

  it('uses stable expiry order independently of input order', () => {
    const entries = [
      {
        householdId: 'household:2',
        displacedAtMacroHourIndex: macroHour(20),
        expiresAtMacroHourIndex: macroHour(50),
        minimumResidentCapacity: 1,
        displacementPressure: 1,
        deterministicSequence: 2,
      },
      {
        householdId: 'household:1',
        displacedAtMacroHourIndex: macroHour(10),
        expiresAtMacroHourIndex: macroHour(40),
        minimumResidentCapacity: 1,
        displacementPressure: 1,
        deterministicSequence: 1,
      },
    ] as const;
    expect(orderDisplacedHouseholds(entries).map((entry) => entry.householdId)).toEqual([
      'household:1',
      'household:2',
    ]);
  });
});
import { macroHour } from './temporal-fixtures.js';
