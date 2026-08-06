import { describe, expect, it } from 'vitest';
import { orderDisplacedHouseholds, planDisplaceHousehold } from '../src/index.js';
import { residentHouseholdSnapshot } from './housing-fixtures.js';

describe('displaced Household queue', () => {
  it('creates one entry with the exact 720-tick expiry', () => {
    const displaced = planDisplaceHousehold({
      snapshot: residentHouseholdSnapshot(),
      householdId: 'household:1',
      displacedAtTick: 40,
    });
    expect(displaced.migration.displacedHouseholds).toEqual([
      expect.objectContaining({
        householdId: 'household:1',
        displacedAtTick: 40,
        expiresAtTick: 760,
        minimumResidentCapacity: 1,
      }),
    ]);
    expect(
      planDisplaceHousehold({
        snapshot: displaced,
        householdId: 'household:1',
        displacedAtTick: 41,
      }),
    ).toBe(displaced);
  });

  it('uses stable expiry order independently of input order', () => {
    const entries = [
      {
        householdId: 'household:2',
        displacedAtTick: 20,
        expiresAtTick: 50,
        minimumResidentCapacity: 1,
        displacementPressure: 1,
        deterministicSequence: 2,
      },
      {
        householdId: 'household:1',
        displacedAtTick: 10,
        expiresAtTick: 40,
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
