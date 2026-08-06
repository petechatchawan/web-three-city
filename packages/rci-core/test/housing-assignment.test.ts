import { describe, expect, it } from 'vitest';
import {
  planStartHousingAssignment,
  synchronizeDwellingInventory,
} from '../src/index.js';
import {
  activeCottageBuildings,
  housingRegistries,
  residentHouseholdSnapshot,
} from './housing-fixtures.js';

describe('housing assignments', () => {
  it('allocates one stable assignment per Household and Unit', () => {
    const withUnit = synchronizeDwellingInventory({
      snapshot: residentHouseholdSnapshot(),
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      evaluationTick: 32,
    }).proposedSnapshot;
    const assigned = planStartHousingAssignment({
      snapshot: withUnit,
      householdId: 'household:1',
      dwellingUnitId: 'dwelling:building:growth:1:0',
      startedAtTick: 32,
    });
    expect(assigned.housing.assignments[0]?.housingAssignmentId).toBe(
      'housing-assignment:1',
    );
    expect(() =>
      planStartHousingAssignment({
        snapshot: assigned,
        householdId: 'household:1',
        dwellingUnitId: 'dwelling:building:growth:1:0',
        startedAtTick: 33,
      }),
    ).toThrow('rci:duplicate-active-housing');
  });
});
