import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  synchronizeDwellingInventory,
  synchronizeWorkplaceInventory,
  type RciDefinitionRegistries,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import {
  recallMobilityTrafficState,
  rememberMobilityTrafficState,
} from '../mobility-traffic-state-registry.js';

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
  const reconciled = synchronizeWorkplaceInventory({ ...input, snapshot: housing }).proposedSnapshot;
  const mobilityTraffic = recallMobilityTrafficState(input.rci);
  if (mobilityTraffic !== null) {
    rememberMobilityTrafficState(
      reconciled,
      mobilityTraffic.mobility,
      mobilityTraffic.traffic,
    );
  }
  return reconciled;
}
