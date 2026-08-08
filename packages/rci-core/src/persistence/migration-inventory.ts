import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { synchronizeWorkplaceInventory } from '../employment/workplace-inventory.js';
import { synchronizeDwellingInventory } from '../housing/dwelling-inventory.js';
import { createInitialRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function createRciMigrationInventory(
  input: Readonly<{
    buildings: BuildingSnapshot;
    absoluteTick: number;
    registries: RciDefinitionRegistries;
    deterministicSeed?: number;
  }>,
): RciSnapshot {
  const initial = createInitialRciSnapshot({
    absoluteTick: input.absoluteTick,
    ...(input.deterministicSeed === undefined
      ? {}
      : { deterministicSeed: input.deterministicSeed }),
  });
  const emptyBuildings = Object.freeze({ revision: 0, instances: Object.freeze([]) });
  const withDwellings = synchronizeDwellingInventory({
    snapshot: initial,
    buildingsBefore: emptyBuildings,
    buildingsAfter: input.buildings,
    registries: input.registries,
    evaluationTick: input.absoluteTick,
  }).proposedSnapshot;
  return synchronizeWorkplaceInventory({
    snapshot: withDwellings,
    buildingsBefore: emptyBuildings,
    buildingsAfter: input.buildings,
    registries: input.registries,
    evaluationTick: input.absoluteTick,
  }).proposedSnapshot;
}
