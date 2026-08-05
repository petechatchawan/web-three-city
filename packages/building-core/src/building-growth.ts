import {
  commitSimulationTick,
  createSimulationSnapshot,
  isDevelopmentEvaluationTick,
  planSimulationTick,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import { occupiedCellsForBuilding } from './building-footprint.js';
import { activateCompletedBuilding, normalizeBuildingInstance } from './building-lifecycle.js';
import { planBuildingDevelopment } from './building-mutation.js';
import { createBuildingSnapshot } from './building-snapshot.js';
import {
  BuildingContractError,
  type AuthoritativeBuildingInstance,
  type BuildingDevelopmentEnvironment,
  type BuildingGrowthInvalidReason,
  type BuildingGrowthPlan,
  type BuildingGrowthReceipt,
  type BuildingSnapshot,
} from './contracts.js';

function frozenStrings(values: Iterable<string>): readonly string[] {
  return Object.freeze([...values].sort((first, second) => first.localeCompare(second)));
}

function frozenChunks(chunks: Iterable<ChunkCoord>): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()]
      .sort((first, second) => first.z - second.z || first.x - second.x)
      .map((chunk) => Object.freeze({ ...chunk })),
  );
}

function environmentValid(environment: BuildingDevelopmentEnvironment): boolean {
  return (
    Number.isSafeInteger(environment.terrainRevision) &&
    environment.terrainRevision >= 0 &&
    Number.isSafeInteger(environment.waterSourceTerrainRevision) &&
    environment.waterSourceTerrainRevision === environment.terrainRevision &&
    Number.isSafeInteger(environment.roadRevision) &&
    environment.roadRevision >= 0 &&
    Number.isSafeInteger(environment.zoneRevision) &&
    environment.zoneRevision >= 0
  );
}

function invalidPlan(
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
  environment: BuildingDevelopmentEnvironment,
  reason: BuildingGrowthInvalidReason,
): BuildingGrowthPlan {
  return Object.freeze({
    baseBuildingRevision: buildings.revision,
    baseSimulationRevision: simulation.revision,
    baseTerrainRevision: environment.terrainRevision,
    baseWaterSourceTerrainRevision: environment.waterSourceTerrainRevision,
    baseRoadRevision: environment.roadRevision,
    baseZoneRevision: environment.zoneRevision,
    beforeAbsoluteTick: simulation.absoluteTick,
    afterAbsoluteTick: simulation.absoluteTick,
    proposedInstances: Object.freeze([]),
    startedInstanceIds: Object.freeze([]),
    completedInstanceIds: Object.freeze([]),
    nextGrowthSequence: simulation.growthSequence,
    dirtyChunks: Object.freeze([]),
    valid: false,
    invalidReason: reason,
  });
}

export function planBuildingGrowthTick(input: {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
}): BuildingGrowthPlan {
  let buildings: BuildingSnapshot;
  let simulation: SimulationSnapshot;
  try {
    buildings = createBuildingSnapshot(input.buildings, input.config);
  } catch {
    return invalidPlan(
      input.buildings,
      input.simulation,
      input.environment,
      'building-growth:invalid-building-state',
    );
  }
  try {
    simulation = createSimulationSnapshot(input.simulation);
  } catch {
    return invalidPlan(
      buildings,
      input.simulation,
      input.environment,
      'building-growth:invalid-simulation-state',
    );
  }
  if (!environmentValid(input.environment)) {
    return invalidPlan(
      buildings,
      simulation,
      input.environment,
      'building-growth:invalid-environment',
    );
  }

  const simulationPlan = planSimulationTick(simulation);
  if (!simulationPlan.valid) {
    return invalidPlan(
      buildings,
      simulation,
      input.environment,
      'building-growth:tick-overflow',
    );
  }
  const afterAbsoluteTick = simulationPlan.afterAbsoluteTick;
  const completedInstanceIds: string[] = [];
  const dirtyChunks: ChunkCoord[] = [];
  const proposedInstances: AuthoritativeBuildingInstance[] = buildings.instances.map((instance) => {
    if (
      instance.lifecycle === 'construction' &&
      instance.constructionCompletesAtTick <= afterAbsoluteTick
    ) {
      completedInstanceIds.push(instance.instanceId);
      for (const cell of occupiedCellsForBuilding(instance)) {
        dirtyChunks.push(chunkForCell(cell, input.config));
      }
      return activateCompletedBuilding(instance, afterAbsoluteTick);
    }
    return normalizeBuildingInstance(instance);
  });

  const startedInstanceIds: string[] = [];
  let nextGrowthSequence = simulation.growthSequence;
  if (isDevelopmentEvaluationTick(afterAbsoluteTick)) {
    const intermediate = createBuildingSnapshot(
      { revision: buildings.revision, instances: proposedInstances },
      input.config,
    );
    const development = planBuildingDevelopment(
      intermediate,
      input.environment,
      input.config,
    );
    const candidate = development.valid ? development.addedInstances[0] : undefined;
    if (candidate !== undefined) {
      const definition = buildingDefinitionForId(candidate.buildingDefinitionId);
      nextGrowthSequence += 1;
      const construction: AuthoritativeBuildingInstance = Object.freeze({
        instanceId: `building:growth:${nextGrowthSequence}`,
        buildingDefinitionId: candidate.buildingDefinitionId,
        buildingDefinitionVersion: candidate.buildingDefinitionVersion,
        originCell: Object.freeze({ ...candidate.originCell }),
        rotationQuarterTurns: candidate.rotationQuarterTurns,
        lifecycle: 'construction',
        constructionStartedAtTick: afterAbsoluteTick,
        constructionCompletesAtTick:
          afterAbsoluteTick + definition.constructionDurationTicks,
      });
      proposedInstances.push(construction);
      startedInstanceIds.push(construction.instanceId);
      for (const cell of occupiedCellsForBuilding(construction)) {
        dirtyChunks.push(chunkForCell(cell, input.config));
      }
    }
  }

  return Object.freeze({
    baseBuildingRevision: buildings.revision,
    baseSimulationRevision: simulation.revision,
    baseTerrainRevision: input.environment.terrainRevision,
    baseWaterSourceTerrainRevision: input.environment.waterSourceTerrainRevision,
    baseRoadRevision: input.environment.roadRevision,
    baseZoneRevision: input.environment.zoneRevision,
    beforeAbsoluteTick: simulation.absoluteTick,
    afterAbsoluteTick,
    proposedInstances: Object.freeze(proposedInstances.map(normalizeBuildingInstance)),
    startedInstanceIds: frozenStrings(startedInstanceIds),
    completedInstanceIds: frozenStrings(completedInstanceIds),
    nextGrowthSequence,
    dirtyChunks: frozenChunks(dirtyChunks),
    valid: true,
    invalidReason: null,
  });
}

export function commitBuildingGrowthTick(input: {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
  readonly plan: BuildingGrowthPlan;
}): Readonly<{
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly receipt: BuildingGrowthReceipt;
}> {
  const { plan } = input;
  if (!plan.valid || plan.invalidReason !== null) {
    throw new BuildingContractError('building-growth:invalid-plan');
  }
  if (input.buildings.revision !== plan.baseBuildingRevision) {
    throw new BuildingContractError('building:stale-building-plan');
  }
  if (
    input.simulation.revision !== plan.baseSimulationRevision ||
    input.simulation.absoluteTick !== plan.beforeAbsoluteTick
  ) {
    throw new BuildingContractError('building-growth:stale-simulation-plan');
  }
  if (input.environment.terrainRevision !== plan.baseTerrainRevision) {
    throw new BuildingContractError('building:stale-terrain-plan');
  }
  if (input.environment.waterSourceTerrainRevision !== plan.baseWaterSourceTerrainRevision) {
    throw new BuildingContractError('building:stale-water-plan');
  }
  if (input.environment.roadRevision !== plan.baseRoadRevision) {
    throw new BuildingContractError('building:stale-road-plan');
  }
  if (input.environment.zoneRevision !== plan.baseZoneRevision) {
    throw new BuildingContractError('building:stale-zone-plan');
  }

  const simulationPlan = planSimulationTick(input.simulation);
  if (!simulationPlan.valid || simulationPlan.afterAbsoluteTick !== plan.afterAbsoluteTick) {
    throw new BuildingContractError('building-growth:stale-simulation-plan');
  }
  const simulationCommit = commitSimulationTick(
    input.simulation,
    simulationPlan,
    plan.nextGrowthSequence,
  );
  const buildingChanged =
    plan.startedInstanceIds.length > 0 || plan.completedInstanceIds.length > 0;
  const buildings = buildingChanged
    ? createBuildingSnapshot(
        {
          revision: input.buildings.revision + 1,
          instances: plan.proposedInstances,
        },
        input.config,
      )
    : input.buildings;

  return Object.freeze({
    buildings,
    simulation: simulationCommit.snapshot,
    receipt: Object.freeze({
      beforeBuildingRevision: input.buildings.revision,
      afterBuildingRevision: buildings.revision,
      beforeSimulationRevision: input.simulation.revision,
      afterSimulationRevision: simulationCommit.snapshot.revision,
      beforeAbsoluteTick: input.simulation.absoluteTick,
      afterAbsoluteTick: simulationCommit.snapshot.absoluteTick,
      startedInstanceIds: plan.startedInstanceIds,
      completedInstanceIds: plan.completedInstanceIds,
      dirtyChunks: plan.dirtyChunks,
    }),
  });
}
