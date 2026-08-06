import { describe, expect, it } from 'vitest';
import { createRciMigrationInventory, encodeRciSaveV1 } from '../src/index.js';
import { activeCottageBuildings, housingRegistries } from './housing-fixtures.js';

describe('prior-save RCI housing migration', () => {
  it('derives empty occupancy inventory from active Buildings without inventing Citizens', () => {
    const migrated = createRciMigrationInventory({
      buildings: activeCottageBuildings,
      absoluteTick: 80,
      registries: housingRegistries,
      deterministicSeed: 5,
    });
    expect(migrated.population.citizens).toEqual([]);
    expect(migrated.housing.dwellingUnits).toEqual([
      expect.objectContaining({
        dwellingUnitId: 'dwelling:building:growth:1:0',
        activatedAtTick: 24,
        retiredAtTick: null,
      }),
    ]);
    expect(migrated.housing.assignments).toEqual([]);
    expect(encodeRciSaveV1(migrated).deterministicSeed).toBe(5);
  });
});
