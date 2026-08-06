import type { BuildingSnapshot } from '@web-three-city/building-core';
import { describe, expect, it } from 'vitest';
import {
  createInitialRciSnapshot,
  synchronizeDwellingInventory,
} from '../src/index.js';
import { activeCottageBuildings, housingRegistries } from './housing-fixtures.js';

const emptyBuildings: BuildingSnapshot = Object.freeze({
  revision: 0,
  instances: Object.freeze([]),
});

describe('dwelling inventory synchronization', () => {
  it('materializes stable units only for active residential buildings', () => {
    const result = synchronizeDwellingInventory({
      snapshot: createInitialRciSnapshot({ absoluteTick: 24 }),
      buildingsBefore: emptyBuildings,
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      evaluationTick: 24,
    });
    expect(result.activatedDwellingUnitIds).toEqual(['dwelling:building:growth:1:0']);
    expect(result.proposedSnapshot.housing.dwellingUnits[0]).toMatchObject({
      buildingInstanceId: 'building:growth:1',
      unitIndex: 0,
      capacityProfileDefinitionId: 'capacity.residential.cottage.v1',
      retiredAtTick: null,
    });
  });

  it('is idempotent and retires units when the building disappears', () => {
    const first = synchronizeDwellingInventory({
      snapshot: createInitialRciSnapshot({ absoluteTick: 24 }),
      buildingsBefore: emptyBuildings,
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      evaluationTick: 24,
    }).proposedSnapshot;
    const second = synchronizeDwellingInventory({
      snapshot: first,
      buildingsBefore: activeCottageBuildings,
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      evaluationTick: 25,
    });
    expect(second.proposedSnapshot).toBe(first);

    const retired = synchronizeDwellingInventory({
      snapshot: first,
      buildingsBefore: activeCottageBuildings,
      buildingsAfter: { revision: 2, instances: [] },
      registries: housingRegistries,
      evaluationTick: 30,
    });
    expect(retired.retiredDwellingUnitIds).toEqual(['dwelling:building:growth:1:0']);
    expect(retired.proposedSnapshot.housing.dwellingUnits[0]?.retiredAtTick).toBe(30);
  });
});
