import {
  commitBuildingGrowthTick,
  planBuildingGrowthTick,
  type BuildingDevelopmentEnvironment,
  type BuildingGrowthReceipt,
} from '@web-three-city/building-core';
import {
  createTaxPressureProjection,
  FOUNDATION_ECONOMY_RULES,
  settleScheduledEconomy,
} from '@web-three-city/economy-core';
import {
  FOUNDATION_RCI_CONFIGURATION,
  commitRciTick,
  createBuildingGrowthPolicy,
  createRciProjection,
  planRciTick,
  type RciDefinitionRegistries,
  type RciDemandFactorContribution,
  type RciTickReceipt,
} from '@web-three-city/rci-core';
import { occupiedRoadCellCount } from '@web-three-city/road-core';
import { deriveGameCalendar } from '@web-three-city/simulation-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  createGameWorldState,
  GameWorldStateStore,
  type GameWorldState,
  type GameWorldStateInput,
} from './game-world-state.js';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import { planMobilityTrafficTick } from './mobility-traffic-tick.js';
import { rememberTrafficJourneyReceipts } from './traffic-journey-receipt-registry.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';

export interface GameWorldTickPlan {
  readonly baseWorldRevision: number;
  readonly proposedState: GameWorldState;
  readonly buildingReceipt: BuildingGrowthReceipt;
  readonly rciReceipt: RciTickReceipt;
  readonly rciDemandContributions: readonly RciDemandFactorContribution[];
  readonly mobilityReceipts: readonly Readonly<Record<string, unknown>>[];
  readonly trafficReceipts: readonly Readonly<Record<string, unknown>>[];
  readonly valid: boolean;
  readonly invalidReason: string | null;
}

export function requiresMobilityTrafficSourceDerivation(
  input: Readonly<{
    citizenCount: number;
    mobility: GameWorldState['mobility'];
    traffic: GameWorldState['traffic'];
  }>,
): boolean {
  return (
    input.citizenCount > 0 ||
    input.mobility.citizenStates.length > 0 ||
    input.mobility.trips.length > 0 ||
    input.traffic.activeTrips.length > 0
  );
}

function emptyRciReceipt(state: GameWorldState): RciTickReceipt {
  return Object.freeze({
    beforeRevision: state.rci.revision,
    afterRevision: state.rci.revision,
    beforeAbsoluteTick: state.simulation.absoluteTick,
    afterAbsoluteTick: state.simulation.absoluteTick,
    emittedEventCount: 0,
  });
}

function invalidTickPlan(
  input: Readonly<{
    state: GameWorldState;
    buildingReceipt: BuildingGrowthReceipt;
    rciReceipt: RciTickReceipt;
    contributions?: readonly RciDemandFactorContribution[];
    reason: string | null;
  }>,
): GameWorldTickPlan {
  return Object.freeze({
    baseWorldRevision: input.state.revision,
    proposedState: input.state,
    buildingReceipt: input.buildingReceipt,
    rciReceipt: input.rciReceipt,
    rciDemandContributions: input.contributions ?? Object.freeze([]),
    mobilityReceipts: Object.freeze([]),
    trafficReceipts: Object.freeze([]),
    valid: false,
    invalidReason: input.reason ?? 'game-world-tick:invalid-stage',
  });
}

export function planGameWorldTick(
  input: Readonly<{
    state: GameWorldStateInput;
    environment: BuildingDevelopmentEnvironment;
    config: WorldConfig;
    registries: RciDefinitionRegistries;
    reservedCells?: readonly CellCoord[];
  }>,
): GameWorldTickPlan {
  const state = createGameWorldState(input.state);
  const taxPressure = createTaxPressureProjection(
    state.economy.taxPolicy,
    FOUNDATION_ECONOMY_RULES,
  );
  const buildingPlan = planBuildingGrowthTick({
    buildings: state.buildings,
    simulation: state.simulation,
    environment: input.environment,
    config: input.config,
    growthPolicy: createBuildingGrowthPolicy(state.rci),
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  if (!buildingPlan.valid) {
    return invalidTickPlan({
      state,
      buildingReceipt: Object.freeze({
        beforeBuildingRevision: state.buildings.revision,
        afterBuildingRevision: state.buildings.revision,
        beforeSimulationRevision: state.simulation.revision,
        afterSimulationRevision: state.simulation.revision,
        beforeAbsoluteTick: state.simulation.absoluteTick,
        afterAbsoluteTick: state.simulation.absoluteTick,
        startedInstanceIds: Object.freeze([]),
        completedInstanceIds: Object.freeze([]),
        dirtyChunks: Object.freeze([]),
      }),
      rciReceipt: emptyRciReceipt(state),
      reason: buildingPlan.invalidReason,
    });
  }

  const buildingCommit = commitBuildingGrowthTick({
    buildings: state.buildings,
    simulation: state.simulation,
    environment: input.environment,
    config: input.config,
    plan: buildingPlan,
  });
  const rciPlan = planRciTick({
    rci: state.rci,
    simulationBefore: state.simulation,
    simulationAfter: buildingCommit.simulation,
    buildingsBefore: state.buildings,
    buildingsAfter: buildingCommit.buildings,
    registries: input.registries,
    configuration: FOUNDATION_RCI_CONFIGURATION,
    externalDemandFactors: (taxPressure.ok ? taxPressure.factors : [])
      .filter((factor) => factor.pressureMilli !== 0)
      .map((factor) => ({
        id: factor.id,
        channel: factor.channel,
        weightMilli: factor.weightMilli,
        evaluate: () => factor.pressureMilli,
      })),
  });
  if (!rciPlan.valid) {
    return invalidTickPlan({
      state,
      buildingReceipt: buildingCommit.receipt,
      rciReceipt: emptyRciReceipt(state),
      reason: rciPlan.invalidReason,
    });
  }

  const rciCommit = commitRciTick({
    rci: state.rci,
    simulationBefore: state.simulation,
    simulationAfter: buildingCommit.simulation,
    buildingsBefore: state.buildings,
    buildingsAfter: buildingCommit.buildings,
    plan: rciPlan,
  });

  let mobilityTraffic;
  try {
    const citizensAfter = createPresentCitizenMobilityProjection(
      rciCommit.snapshot,
      buildingCommit.buildings,
      buildingCommit.simulation.absoluteTick,
    );
    const trafficSource = requiresMobilityTrafficSourceDerivation({
      citizenCount: citizensAfter.length,
      mobility: state.mobility,
      traffic: state.traffic,
    })
      ? Object.freeze({
          roads: createRoadTrafficSourceProjectionFromEnvironment(state.roads, input.environment),
          buildingAccess: createBuildingTrafficAccessProjection(
            buildingCommit.buildings,
            state.roads,
            input.environment,
          ),
        })
      : Object.freeze({
          roads: Object.freeze({
            roadRevision: state.roads.revision,
            width: input.config.mapWidth,
            height: input.config.mapHeight,
            cells: Object.freeze([]),
          }),
          buildingAccess: Object.freeze({
            buildingRevision: buildingCommit.buildings.revision,
            accesses: Object.freeze([]),
          }),
        });
    mobilityTraffic = planMobilityTrafficTick({
      mobilityBefore: state.mobility,
      trafficBefore: state.traffic,
      citizensAfter,
      simulationBefore: state.simulation,
      simulationAfter: buildingCommit.simulation,
      trafficSource,
    });
  } catch (error) {
    return invalidTickPlan({
      state,
      buildingReceipt: buildingCommit.receipt,
      rciReceipt: rciCommit.receipt,
      contributions: rciPlan.demandContributions,
      reason: `mobility-traffic:${error instanceof Error ? error.message : 'unknown'}`,
    });
  }

  const rciProjection = createRciProjection(
    rciCommit.snapshot,
    input.registries,
    buildingCommit.simulation.absoluteTick,
  );
  const settlement = settleScheduledEconomy(
    state.economy,
    {
      beforeTick: state.simulation.absoluteTick,
      afterTick: buildingCommit.simulation.absoluteTick,
      calendar: deriveGameCalendar(buildingCommit.simulation.absoluteTick),
      taxableActivity: {
        occupiedResidentialDwellings: rciProjection.housing.occupiedDwellingCount,
        occupiedCommercialPositions:
          rciProjection.factorContext.commercialPositionCapacity -
          rciProjection.factorContext.commercialVacantPositionCount,
        occupiedIndustrialPositions:
          rciProjection.factorContext.industrialPositionCapacity -
          rciProjection.factorContext.industrialVacantPositionCount,
      },
      roadMaintenance: { occupiedRoadCells: occupiedRoadCellCount(state.roads) },
    },
    FOUNDATION_ECONOMY_RULES,
  );
  if (!settlement.ok) {
    return invalidTickPlan({
      state,
      buildingReceipt: buildingCommit.receipt,
      rciReceipt: rciCommit.receipt,
      contributions: rciPlan.demandContributions,
      reason: `economy:${settlement.reason}`,
    });
  }

  return Object.freeze({
    baseWorldRevision: state.revision,
    proposedState: Object.freeze({
      revision: state.revision + 1,
      simulation: buildingCommit.simulation,
      buildings: buildingCommit.buildings,
      rci: rciCommit.snapshot,
      roads: state.roads,
      economy: settlement.snapshot,
      mobility: mobilityTraffic.mobility,
      traffic: mobilityTraffic.traffic,
    }),
    buildingReceipt: buildingCommit.receipt,
    rciReceipt: rciCommit.receipt,
    rciDemandContributions: rciPlan.demandContributions,
    mobilityReceipts: mobilityTraffic.mobilityReceipts,
    trafficReceipts: mobilityTraffic.trafficReceipts,
    valid: true,
    invalidReason: null,
  });
}

export function commitGameWorldTick(
  store: GameWorldStateStore,
  plan: GameWorldTickPlan,
): GameWorldState {
  if (!plan.valid || plan.invalidReason !== null) throw new Error('game-world-tick:invalid-plan');
  return store.replace(plan.baseWorldRevision, plan.proposedState);
}

export function executeGameWorldTick(
  input: Readonly<{
    store: GameWorldStateStore;
    environment: BuildingDevelopmentEnvironment;
    config: WorldConfig;
    registries: RciDefinitionRegistries;
    reservedCells?: readonly CellCoord[];
  }>,
): Readonly<{
  state: GameWorldState;
  buildingReceipt: BuildingGrowthReceipt;
  rciReceipt: RciTickReceipt;
  mobilityReceipts: readonly Readonly<Record<string, unknown>>[];
  trafficReceipts: readonly Readonly<Record<string, unknown>>[];
}> {
  const plan = planGameWorldTick({
    state: input.store.snapshot(),
    environment: input.environment,
    config: input.config,
    registries: input.registries,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  const state = commitGameWorldTick(input.store, plan);
  rememberTrafficJourneyReceipts(state.rci, plan.trafficReceipts);
  return Object.freeze({
    state,
    buildingReceipt: plan.buildingReceipt,
    rciReceipt: plan.rciReceipt,
    mobilityReceipts: plan.mobilityReceipts,
    trafficReceipts: plan.trafficReceipts,
  });
}
