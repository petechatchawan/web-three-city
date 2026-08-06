import { describe, expect, it } from 'vitest';
import {
  encodeRciSaveV1,
  synchronizeDwellingInventory,
} from '../src/index.js';
import {
  activeCottageBuildings,
  housingRegistries,
  residentHouseholdSnapshot,
} from './housing-fixtures.js';

describe('housing determinism', () => {
  it('produces canonical Save output under Building-array permutation', () => {
    const secondBuilding = {
      ...activeCottageBuildings.instances[0]!,
      instanceId: 'building:growth:2',
      originCell: { x: 4, z: 4 },
    };
    const forwardBuildings = {
      revision: 2,
      instances: [activeCottageBuildings.instances[0]!, secondBuilding],
    };
    const reverseBuildings = {
      revision: 2,
      instances: [...forwardBuildings.instances].reverse(),
    };
    const input = residentHouseholdSnapshot();
    const forward = synchronizeDwellingInventory({
      snapshot: input,
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: forwardBuildings,
      registries: housingRegistries,
      evaluationTick: 32,
    }).proposedSnapshot;
    const reverse = synchronizeDwellingInventory({
      snapshot: input,
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: reverseBuildings,
      registries: housingRegistries,
      evaluationTick: 32,
    }).proposedSnapshot;
    expect(encodeRciSaveV1(forward)).toEqual(encodeRciSaveV1(reverse));
  });
});
