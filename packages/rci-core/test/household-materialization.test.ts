import { describe, expect, it } from 'vitest';
import {
  createFoundationQualificationResolver,
  planMaterializeIncomingHousehold,
  synchronizeDwellingInventory,
} from '../src/index.js';
import {
  activeCottageBuildings,
  housingRegistries,
  residentHouseholdSnapshot,
} from './housing-fixtures.js';

describe('incoming Household materialization', () => {
  it('allocates authority only after a suitable Unit is selected', () => {
    const withUnit = synchronizeDwellingInventory({
      snapshot: residentHouseholdSnapshot(),
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      evaluationMacroHourIndex: macroHour(32),
    }).proposedSnapshot;
    const queued = {
      ...withUnit,
      migration: {
        ...withUnit.migration,
        incomingRequests: [
          {
            requestId: 'incoming-household:1',
            archetypeDefinitionId: 'migration.single-adult.v1',
            requestedAtMacroHourIndex: macroHour(32),
            minimumResidentCapacity: 1,
            queuePriority: 0,
            deterministicSequence: 1,
          },
        ],
      },
      sequences: { ...withUnit.sequences, nextIncomingRequest: 2 },
    };
    const materialized = planMaterializeIncomingHousehold({
      snapshot: queued,
      requestId: 'incoming-household:1',
      dwellingUnitId: 'dwelling:building:growth:1:0',
      evaluationMacroHourIndex: macroHour(32),
      registries: housingRegistries,
      qualificationResolver: createFoundationQualificationResolver(housingRegistries),
    });
    expect(materialized.population.citizens).toHaveLength(2);
    expect(materialized.households.households).toHaveLength(2);
    expect(materialized.housing.assignments).toHaveLength(1);
    expect(materialized.migration.incomingRequests).toEqual([]);
    expect(materialized.sequences.nextCitizen).toBe(3);
  });

  it('does not preallocate authority while a request remains queued', () => {
    const snapshot = residentHouseholdSnapshot();
    expect(snapshot.sequences.nextCitizen).toBe(2);
    expect(snapshot.population.citizens).toHaveLength(1);
  });
});
import { macroHour } from './temporal-fixtures.js';
