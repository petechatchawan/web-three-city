import {
  commitBuildingGrowthTick,
  planBuildingGrowthTick,
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
import {
  commitSimulationMinute,
  deriveGameCalendarFromGameMinute,
  deriveMacroHourTransition,
  planSimulationMinute,
  type MacroHourTransition,
} from '@web-three-city/simulation-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  createTrafficSnapshot,
  createTrafficSnapshotV2,
  type ActiveTransportTripV2,
  type TrafficSnapshotV1,
  type TrafficSnapshotV2,
} from '@web-three-city/traffic-core';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import { planMobilityTrafficTick } from './mobility-traffic-tick.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import {
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './application/committed-world.js';
import { memoizedFingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import type {
  WorldPresentationPort,
  WorldPublicationResult,
  WorldTransactionCoordinator,
} from './application/world-transaction-coordinator.js';

function trafficV1View(traffic: TrafficSnapshotV1 | TrafficSnapshotV2): TrafficSnapshotV1 {
  if (traffic.schemaVersion === 1) return createTrafficSnapshot(traffic);
  return createTrafficSnapshot({
    schemaVersion: 1,
    revision: traffic.revision,
    policyVersion: traffic.policyVersion,
    graphSourceRoadRevision: traffic.graphSourceRoadRevision,
    graphSourceBuildingRevision: traffic.graphSourceBuildingRevision,
    activeTrips: traffic.activeTrips.map((trip) => ({
      tripId: trip.tripId,
      citizenId: trip.citizenId,
      mode: trip.mode,
      originBuildingId: trip.originBuildingId,
      destinationBuildingId: trip.destinationBuildingId,
      routeEdgeIds: trip.routeEdgeIds,
      routeGraphRevision: trip.routeGraphRevision,
      segmentIndex: trip.segmentIndex,
      progressQ: trip.progressQ,
      lastStableNodeId: trip.lastStableNodeId,
      queuedMovement:
        trip.queuedMovement === null
          ? null
          : {
              fromEdgeId: trip.queuedMovement.fromEdgeId,
              toEdgeId: trip.queuedMovement.toEdgeId,
              arrivedAtGameSecond: Math.floor(trip.queuedMovement.arrivedAtTransportSecond / 4),
            },
      status: trip.status,
      failureReason: trip.failureReason,
    })),
  });
}

function trafficV2AtMinute(
  input: Readonly<{
    before: TrafficSnapshotV1 | TrafficSnapshotV2;
    after: TrafficSnapshotV1;
    sourceGameMinute: number;
  }>,
): TrafficSnapshotV2 {
  const previous =
    input.before.schemaVersion === 2
      ? new Map(input.before.activeTrips.map((trip) => [trip.tripId, trip] as const))
      : new Map<string, ActiveTransportTripV2>();
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: input.after.revision,
    policyVersion: input.after.policyVersion,
    graphSourceRoadRevision: input.after.graphSourceRoadRevision,
    graphSourceBuildingRevision: input.after.graphSourceBuildingRevision,
    timeCursor: {
      sourceGameMinute: input.sourceGameMinute,
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: input.sourceGameMinute * 4,
      temporalPolicyVersion: 1,
    },
    activeTrips: input.after.activeTrips.map((trip) => {
      const retained = previous.get(trip.tripId);
      if (retained !== undefined) return retained;
      const queuedMovement =
        trip.queuedMovement === null
          ? null
          : {
              fromEdgeId: trip.queuedMovement.fromEdgeId,
              toEdgeId: trip.queuedMovement.toEdgeId,
              arrivedAtTransportSecond: trip.queuedMovement.arrivedAtGameSecond * 4,
            };
      return {
        ...trip,
        queuedMovement,
        driveMovementPhase:
          trip.mode === 'Drive' && trip.status === 'Active'
            ? trip.progressQ === 0
              ? ('WaitingForEntry' as const)
              : ('Travelling' as const)
            : null,
        entryServiceCredit: 0,
        entryReservationResourceIds: [],
      };
    }),
  });
}

export interface GameMinuteTransactionPlan {
  readonly valid: boolean;
  readonly invalidReason: string | null;
  readonly baseWorldRevision: number;
  readonly baseFingerprint: string;
  readonly nextWorld: CommittedWorld;
  readonly nextFingerprint: string;
  readonly buildingReceipt: BuildingGrowthReceipt | null;
  readonly rciReceipt: RciTickReceipt | null;
  readonly rciDemandContributions: readonly RciDemandFactorContribution[];
  readonly mobilityReceipts: readonly Readonly<Record<string, unknown>>[];
  readonly trafficReceipts: readonly Readonly<Record<string, unknown>>[];
}

function invalidPlan(world: CommittedWorld, reason: string): GameMinuteTransactionPlan {
  const fingerprint = memoizedFingerprintCommittedWorld(world);
  return Object.freeze({
    valid: false,
    invalidReason: reason,
    baseWorldRevision: world.revision,
    baseFingerprint: fingerprint,
    nextWorld: world,
    nextFingerprint: fingerprint,
    buildingReceipt: null,
    rciReceipt: null,
    rciDemandContributions: Object.freeze([]),
    mobilityReceipts: Object.freeze([]),
    trafficReceipts: Object.freeze([]),
  });
}

type MacroHourConsumerPlan =
  | Readonly<{ invalidReason: string }>
  | Readonly<{
      invalidReason: null;
      buildings: CommittedWorld['buildings'];
      rci: CommittedWorld['rci'];
      simulation: CommittedWorld['simulation'];
      growthSequence: number;
      buildingReceipt: BuildingGrowthReceipt | null;
      rciReceipt: RciTickReceipt | null;
      rciDemandContributions: readonly RciDemandFactorContribution[];
    }>;

function planMacroHourConsumers(
  input: Readonly<{
    world: CommittedWorld;
    registries: RciDefinitionRegistries;
    simulation: CommittedWorld['simulation'];
    simulationPlan: ReturnType<typeof planSimulationMinute>;
    macroHourTransition: MacroHourTransition;
    reservedCells?: readonly CellCoord[];
    automaticGrowth?: boolean;
  }>,
): MacroHourConsumerPlan {
  let buildings = input.world.buildings;
  let rci = input.world.rci;
  let growthSequence = input.world.simulation.growthSequence;
  let buildingReceipt: BuildingGrowthReceipt | null = null;
  let rciReceipt: RciTickReceipt | null = null;
  let rciDemandContributions: readonly RciDemandFactorContribution[] = Object.freeze([]);

  if (!input.macroHourTransition.crossed || input.automaticGrowth === false) {
    return {
      invalidReason: null,
      buildings,
      rci,
      simulation: input.simulation,
      growthSequence,
      buildingReceipt,
      rciReceipt,
      rciDemandContributions,
    };
  }
  const buildingPlan = planBuildingGrowthTick({
    buildings: input.world.buildings,
    simulation: input.world.simulation,
    environment: input.world.environments.building,
    config: WORLD_CONFIG,
    macroHourTransition: input.macroHourTransition,
    growthPolicy: createBuildingGrowthPolicy(input.world.rci),
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  if (!buildingPlan.valid) {
    return { invalidReason: buildingPlan.invalidReason ?? 'building' };
  }
  growthSequence = buildingPlan.nextGrowthSequence;
  const buildingCommit = commitBuildingGrowthTick({
    buildings: input.world.buildings,
    simulation: input.world.simulation,
    environment: input.world.environments.building,
    config: WORLD_CONFIG,
    plan: buildingPlan,
  });
  buildings = buildingCommit.buildings;
  buildingReceipt = buildingCommit.receipt;
  const simulationAfterGrowth = commitSimulationMinute(
    input.world.simulation,
    input.simulationPlan,
    growthSequence,
  ).snapshot;

  const taxPressure = createTaxPressureProjection(
    input.world.economy.taxPolicy,
    FOUNDATION_ECONOMY_RULES,
  );
  const rciPlan = planRciTick({
    rci: input.world.rci,
    simulationBefore: input.world.simulation,
    simulationAfter: simulationAfterGrowth,
    macroHourTransition: input.macroHourTransition,
    buildingsBefore: input.world.buildings,
    buildingsAfter: buildings,
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
  if (!rciPlan.valid) return { invalidReason: rciPlan.invalidReason ?? 'rci' };
  const rciCommit = commitRciTick({
    rci: input.world.rci,
    simulationBefore: input.world.simulation,
    simulationAfter: simulationAfterGrowth,
    buildingsBefore: input.world.buildings,
    buildingsAfter: buildings,
    plan: rciPlan,
  });
  rci = rciCommit.snapshot;
  rciReceipt = rciCommit.receipt;
  rciDemandContributions = rciPlan.demandContributions;
  return {
    invalidReason: null,
    buildings,
    rci,
    simulation: simulationAfterGrowth,
    growthSequence,
    buildingReceipt,
    rciReceipt,
    rciDemandContributions,
  };
}

export function planGameMinuteTransaction(
  input: Readonly<{
    world: CommittedWorld;
    registries: RciDefinitionRegistries;
    reservedCells?: readonly CellCoord[];
    automaticGrowth?: boolean;
  }>,
): GameMinuteTransactionPlan {
  const { world } = input;
  const simulationPlan = planSimulationMinute(world.simulation);
  if (!simulationPlan.valid)
    return invalidPlan(world, simulationPlan.invalidReason ?? 'simulation');
  const macroHourTransition = deriveMacroHourTransition(
    world.simulation.absoluteGameMinute,
    simulationPlan.afterAbsoluteGameMinute,
  );

  const simulationBase = commitSimulationMinute(
    world.simulation,
    simulationPlan,
    world.simulation.growthSequence,
  ).snapshot;
  const macroHourConsumers = planMacroHourConsumers({
    world,
    registries: input.registries,
    simulation: simulationBase,
    simulationPlan,
    macroHourTransition,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
    ...(input.automaticGrowth === undefined ? {} : { automaticGrowth: input.automaticGrowth }),
  });
  if (macroHourConsumers.invalidReason !== null) {
    return invalidPlan(world, macroHourConsumers.invalidReason);
  }
  const { buildings, rci, simulation, buildingReceipt, rciReceipt, rciDemandContributions } =
    macroHourConsumers;
  try {
    const citizens = createPresentCitizenMobilityProjection(
      rci,
      buildings,
      macroHourTransition.afterMacroHourIndex,
    );
    const mobilityTraffic = planMobilityTrafficTick({
      mobilityBefore: world.mobility,
      trafficBefore: trafficV1View(
        world.traffic as unknown as TrafficSnapshotV1 | TrafficSnapshotV2,
      ),
      citizensAfter: citizens,
      simulationBefore: world.simulation,
      simulationAfter: simulation,
      advanceTraffic: false,
      trafficSource: Object.freeze({
        roads: createRoadTrafficSourceProjectionFromEnvironment(
          world.roads,
          world.environments.building,
        ),
        buildingAccess: createBuildingTrafficAccessProjection(
          buildings,
          world.roads,
          world.environments.building,
        ),
      }),
    });
    const rciProjection = createRciProjection(
      rci,
      input.registries,
      macroHourTransition.afterMacroHourIndex,
    );
    const settlement = macroHourTransition.crossed
      ? settleScheduledEconomy(
          world.economy,
          {
            beforeTick: macroHourTransition.beforeMacroHourIndex,
            afterTick: macroHourTransition.afterMacroHourIndex,
            macroHourTransition,
            calendar: deriveGameCalendarFromGameMinute(simulation.absoluteGameMinute),
            taxableActivity: {
              occupiedResidentialDwellings: rciProjection.housing.occupiedDwellingCount,
              occupiedCommercialPositions:
                rciProjection.factorContext.commercialPositionCapacity -
                rciProjection.factorContext.commercialVacantPositionCount,
              occupiedIndustrialPositions:
                rciProjection.factorContext.industrialPositionCapacity -
                rciProjection.factorContext.industrialVacantPositionCount,
            },
            roadMaintenance: { occupiedRoadCells: occupiedRoadCellCount(world.roads) },
          },
          FOUNDATION_ECONOMY_RULES,
        )
      : { ok: true as const, snapshot: world.economy };
    if (!settlement.ok) return invalidPlan(world, `economy:${settlement.reason}`);
    const traffic = trafficV2AtMinute({
      before: world.traffic as unknown as TrafficSnapshotV1 | TrafficSnapshotV2,
      after: mobilityTraffic.traffic,
      sourceGameMinute: simulation.absoluteGameMinute,
    }) as unknown as typeof world.traffic;
    const nextWorld =
      buildings === world.buildings
        ? createCommittedWorld(
            {
              ...world,
              revision: world.revision + 1,
              simulation,
              buildings,
              rci,
              economy: settlement.snapshot,
              mobility: mobilityTraffic.mobility,
              traffic,
            },
            { reuseStaticFrom: world },
          )
        : createCommittedWorldFromDomainState({
            revision: world.revision + 1,
            terrain: world.terrain,
            roads: world.roads,
            zones: world.zones,
            buildings,
            simulation,
            rci,
            economy: settlement.snapshot,
            mobility: mobilityTraffic.mobility,
            traffic,
          });
    return Object.freeze({
      valid: true,
      invalidReason: null,
      baseWorldRevision: world.revision,
      baseFingerprint: memoizedFingerprintCommittedWorld(world),
      nextWorld,
      nextFingerprint: memoizedFingerprintCommittedWorld(nextWorld),
      buildingReceipt,
      rciReceipt,
      rciDemandContributions,
      mobilityReceipts: mobilityTraffic.mobilityReceipts,
      trafficReceipts: mobilityTraffic.trafficReceipts,
    });
  } catch (error) {
    return invalidPlan(world, error instanceof Error ? error.message : 'minute');
  }
}

export function commitGameMinuteTransaction(
  coordinator: WorldTransactionCoordinator,
  plan: GameMinuteTransactionPlan,
  presentation?: WorldPresentationPort,
  internalCommit = false,
): WorldPublicationResult {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new Error('game-minute-transaction:invalid-plan');
  }
  const publication = {
    baseRevision: plan.baseWorldRevision,
    baseFingerprint: plan.baseFingerprint,
    nextWorld: plan.nextWorld,
    nextFingerprint: plan.nextFingerprint,
    ...(presentation === undefined ? {} : { presentation }),
  };
  return internalCommit
    ? coordinator.publishForTransaction(publication)
    : coordinator.publish(publication);
}

export function executeGameMinuteTransaction(
  input: Readonly<{
    coordinator: WorldTransactionCoordinator;
    registries: RciDefinitionRegistries;
    reservedCells?: readonly CellCoord[];
  }>,
): WorldPublicationResult {
  const plan = planGameMinuteTransaction({
    world: input.coordinator.snapshot(),
    registries: input.registries,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
  });
  return commitGameMinuteTransaction(input.coordinator, plan);
}
