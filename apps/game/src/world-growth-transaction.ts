import {
  commitBuildingGrowthTick,
  planBuildingGrowthTick,
  type BuildingDevelopmentEnvironment,
  type BuildingGrowthReceipt,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';

export interface WorldGrowthState {
  readonly simulation: SimulationSnapshot;
  readonly buildings: BuildingSnapshot;
}

export interface WorldGrowthTickResult extends WorldGrowthState {
  readonly receipt: BuildingGrowthReceipt;
}

export function executeWorldGrowthTick(input: {
  readonly state: WorldGrowthState;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
  readonly reservedCells?: readonly CellCoord[];
}): WorldGrowthTickResult {
  const plan = planBuildingGrowthTick({
    buildings: input.state.buildings,
    simulation: input.state.simulation,
    environment: input.environment,
    config: input.config,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  const committed = commitBuildingGrowthTick({
    buildings: input.state.buildings,
    simulation: input.state.simulation,
    environment: input.environment,
    config: input.config,
    plan,
  });
  return Object.freeze({
    buildings: committed.buildings,
    simulation: committed.simulation,
    receipt: committed.receipt,
  });
}
