import { describe, expect, it } from 'vitest';
import {
  planDisplaceHousehold,
  planHousingReconciliation,
  synchronizeDwellingInventory,
} from '../src/index.js';
import {
  activeCottageBuildings,
  housingRegistries,
  residentHouseholdSnapshot,
} from './housing-fixtures.js';

describe('housing reconciliation', () => {
  it('relocates displaced Households before processing incoming requests', () => {
    const withUnit = synchronizeDwellingInventory({
      snapshot: residentHouseholdSnapshot(),
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      evaluationMacroHourIndex: macroHour(32),
    }).proposedSnapshot;
    const displaced = planDisplaceHousehold({
      snapshot: withUnit,
      householdId: 'household:1',
      displacedAtMacroHourIndex: macroHour(32),
    });
    const result = planHousingReconciliation({
      snapshot: displaced,
      evaluationMacroHourIndex: macroHour(33),
      registries: housingRegistries,
    });
    expect(result.relocatedHouseholdIds).toEqual(['household:1']);
    expect(result.proposedSnapshot.migration.displacedHouseholds).toEqual([]);
    expect(result.proposedSnapshot.housing.assignments[0]).toMatchObject({
      householdId: 'household:1',
      dwellingUnitId: 'dwelling:building:growth:1:0',
      endedAtMacroHourIndex: null,
    });
  });
});
import { macroHour } from './temporal-fixtures.js';
