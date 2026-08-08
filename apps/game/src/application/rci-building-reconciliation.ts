import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  synchronizeDwellingInventory,
  synchronizeWorkplaceInventory,
  type RciDefinitionRegistries,
  type RciSnapshot,
} from '@web-three-city/rci-core';

export function reconcileRciForBuildingChange(
  input: Readonly<{
    rci: RciSnapshot;
    buildingsBefore: BuildingSnapshot;
    buildingsAfter: BuildingSnapshot;
    registries: RciDefinitionRegistries;
    evaluationTick: number;
  }>,
): RciSnapshot {
  const housing = synchronizeDwellingInventory({ ...input, snapshot: input.rci }).proposedSnapshot;
  return synchronizeWorkplaceInventory({ ...input, snapshot: housing }).proposedSnapshot;
}
