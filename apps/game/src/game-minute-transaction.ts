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
import { createCommittedWorld, type CommittedWorld } from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import type {
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
  const fingerprint = fingerprintCommittedWorld(world);
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

  let buildings = world.buildings;
  let rci = world.rci;
  let growthSequence = world.simulation.growthSequence;
  let buildingReceipt: BuildingGrowthReceipt | null = null;
  let rciReceipt: RciTickReceipt | null = null;
  let rciDemandContributions: readonly RciDemandFactorContribution[] = Object.freeze([]);

  if (macroHourTransition.crossed && input.automaticGrowth !== false) {
    const buildingPlan = planBuildingGrowthTick({
      buildings: world.buildings,
      simulation: world.simulation,
      environment: world.environments.building,
      config: WORLD_CONFIG,
      macroHourTransition,
      growthPolicy: createBuildingGrowthPolicy(world.rci),
      ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
    });
    if (!buildingPlan.valid) return invalidPlan(world, buildingPlan.invalidReason ?? 'building');
    growthSequence = buildingPlan.nextGrowthSequence;
    const buildingCommit = commitBuildingGrowthTick({
      buildings: world.buildings,
      simulation: world.simulation,
      environment: world.environments.building,
      config: WORLD_CONFIG,
      plan: buildingPlan,
    });
    buildings = buildingCommit.buildings;
    buildingReceipt = buildingCommit.receipt;
  }

  const simulation = commitSimulationMinute(
    world.simulation,
    simulationPlan,
    growthSequence,
  ).snapshot;

  if (macroHourTransition.crossed && input.automaticGrowth !== false) {
    const taxPressure = createTaxPressureProjection(
      world.economy.taxPolicy,
      FOUNDATION_ECONOMY_RULES,
    );
    const rciPlan = planRciTick({
      rci: world.rci,
      simulationBefore: world.simulation,
      simulationAfter: simulation,
      macroHourTransition,
      buildingsBefore: world.buildings,
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
    if (!rciPlan.valid) return invalidPlan(world, rciPlan.invalidReason ?? 'rci');
    const rciCommit = commitRciTick({
      rci: world.rci,
      simulationBefore: world.simulation,
      simulationAfter: simulation,
      buildingsBefore: world.buildings,
      buildingsAfter: buildings,
      plan: rciPlan,
    });
    rci = rciCommit.snapshot;
    rciReceipt = rciCommit.receipt;
    rciDemandContributions = rciPlan.demandContributions;
  }

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
    const nextWorld = createCommittedWorld({
      ...world,
      revision: world.revision + 1,
      simulation,
      buildings,
      rci,
      economy: settlement.snapshot,
      mobility: mobilityTraffic.mobility,
      traffic: trafficV2AtMinute({
        before: world.traffic as unknown as TrafficSnapshotV1 | TrafficSnapshotV2,
        after: mobilityTraffic.traffic,
        sourceGameMinute: simulation.absoluteGameMinute,
      }) as unknown as typeof world.traffic,
    });
    return Object.freeze({
      valid: true,
      invalidReason: null,
      baseWorldRevision: world.revision,
      baseFingerprint: fingerprintCommittedWorld(world),
      nextWorld,
      nextFingerprint: fingerprintCommittedWorld(nextWorld),
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
): WorldPublicationResult {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new Error('game-minute-transaction:invalid-plan');
  }
  return coordinator.publish({
    baseRevision: plan.baseWorldRevision,
    baseFingerprint: plan.baseFingerprint,
    nextWorld: plan.nextWorld,
    nextFingerprint: plan.nextFingerprint,
  });
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
