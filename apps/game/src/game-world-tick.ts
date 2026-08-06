import {
  commitBuildingGrowthTick,
  planBuildingGrowthTick,
  type BuildingDevelopmentEnvironment,
  type BuildingGrowthReceipt,
} from '@web-three-city/building-core';
import {
  FOUNDATION_RCI_CONFIGURATION,
  commitRciTick,
  createBuildingGrowthPolicy,
  planRciTick,
  type RciDefinitionRegistries,
  type RciTickReceipt,
} from '@web-three-city/rci-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { GameWorldState } from './game-world-state.js';
import { GameWorldStateStore } from './game-world-state.js';

export interface GameWorldTickPlan {
  readonly baseWorldRevision: number;
  readonly proposedState: GameWorldState;
  readonly buildingReceipt: BuildingGrowthReceipt;
  readonly rciReceipt: RciTickReceipt;
  readonly valid: boolean;
  readonly invalidReason: string | null;
}

export function planGameWorldTick(input: Readonly<{
  state: GameWorldState;
  environment: BuildingDevelopmentEnvironment;
  config: WorldConfig;
  registries: RciDefinitionRegistries;
  reservedCells?: readonly CellCoord[];
}>): GameWorldTickPlan {
  const buildingPlan = planBuildingGrowthTick({
    buildings: input.state.buildings,
    simulation: input.state.simulation,
    environment: input.environment,
    config: input.config,
    growthPolicy: createBuildingGrowthPolicy(input.state.rci),
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  if (!buildingPlan.valid) {
    return Object.freeze({
      baseWorldRevision: input.state.revision,
      proposedState: input.state,
      buildingReceipt: Object.freeze({
        beforeBuildingRevision: input.state.buildings.revision,
        afterBuildingRevision: input.state.buildings.revision,
        beforeSimulationRevision: input.state.simulation.revision,
        afterSimulationRevision: input.state.simulation.revision,
        beforeAbsoluteTick: input.state.simulation.absoluteTick,
        afterAbsoluteTick: input.state.simulation.absoluteTick,
        startedInstanceIds: Object.freeze([]),
        completedInstanceIds: Object.freeze([]),
        dirtyChunks: Object.freeze([]),
      }),
      rciReceipt: Object.freeze({
        beforeRevision: input.state.rci.revision,
        afterRevision: input.state.rci.revision,
        beforeAbsoluteTick: input.state.simulation.absoluteTick,
        afterAbsoluteTick: input.state.simulation.absoluteTick,
        emittedEventCount: 0,
      }),
      valid: false,
      invalidReason: buildingPlan.invalidReason,
    });
  }
  const buildingCommit = commitBuildingGrowthTick({
    buildings: input.state.buildings,
    simulation: input.state.simulation,
    environment: input.environment,
    config: input.config,
    plan: buildingPlan,
  });
  const rciPlan = planRciTick({
    rci: input.state.rci,
    simulationBefore: input.state.simulation,
    simulationAfter: buildingCommit.simulation,
    buildingsBefore: input.state.buildings,
    buildingsAfter: buildingCommit.buildings,
    registries: input.registries,
    configuration: FOUNDATION_RCI_CONFIGURATION,
  });
  if (!rciPlan.valid) {
    return Object.freeze({
      baseWorldRevision: input.state.revision,
      proposedState: input.state,
      buildingReceipt: buildingCommit.receipt,
      rciReceipt: Object.freeze({
        beforeRevision: input.state.rci.revision,
        afterRevision: input.state.rci.revision,
        beforeAbsoluteTick: input.state.simulation.absoluteTick,
        afterAbsoluteTick: input.state.simulation.absoluteTick,
        emittedEventCount: 0,
      }),
      valid: false,
      invalidReason: rciPlan.invalidReason,
    });
  }
  const rciCommit = commitRciTick({
    rci: input.state.rci,
    simulationBefore: input.state.simulation,
    simulationAfter: buildingCommit.simulation,
    buildingsBefore: input.state.buildings,
    buildingsAfter: buildingCommit.buildings,
    plan: rciPlan,
  });
  return Object.freeze({
    baseWorldRevision: input.state.revision,
    proposedState: Object.freeze({
      revision: input.state.revision + 1,
      simulation: buildingCommit.simulation,
      buildings: buildingCommit.buildings,
      rci: rciCommit.snapshot,
    }),
    buildingReceipt: buildingCommit.receipt,
    rciReceipt: rciCommit.receipt,
    valid: true,
    invalidReason: null,
  });
}

export function commitGameWorldTick(
  store: GameWorldStateStore,
  plan: GameWorldTickPlan,
): GameWorldState {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new Error('game-world-tick:invalid-plan');
  }
  return store.replace(plan.baseWorldRevision, plan.proposedState);
}

export function executeGameWorldTick(input: Readonly<{
  store: GameWorldStateStore;
  environment: BuildingDevelopmentEnvironment;
  config: WorldConfig;
  registries: RciDefinitionRegistries;
  reservedCells?: readonly CellCoord[];
}>): Readonly<{
  state: GameWorldState;
  buildingReceipt: BuildingGrowthReceipt;
  rciReceipt: RciTickReceipt;
}> {
  const plan = planGameWorldTick({
    state: input.store.snapshot(),
    environment: input.environment,
    config: input.config,
    registries: input.registries,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  const state = commitGameWorldTick(input.store, plan);
  return Object.freeze({
    state,
    buildingReceipt: plan.buildingReceipt,
    rciReceipt: plan.rciReceipt,
  });
}
