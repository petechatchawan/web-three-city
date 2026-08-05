import {
  commitSimulationTick,
  createSimulationSnapshot,
  isDevelopmentEvaluationTick,
  planSimulationTick,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import { occupiedCellsForBuilding } from './building-footprint.js';
import { activateCompletedBuilding, normalizeBuildingInstance } from './building-lifecycle.js';
import { selectGrowthBuildingPlacement } from './building-selection.js';
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
  return Object.freeze([...values].sort((a, b) => a.localeCompare(b)));
}

function frozenChunks(chunks: Iterable<ChunkCoord>): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()]
      .sort((a, b) => a.z - b.z || a.x - b.x)
      .map((chunk) => Object.freeze({ ...chunk })),
  );
}

function environmentValid(environment: BuildingDevelopmentEnvironment): boolean {
  return (
    Number.isSafeInteger(environment.terrainRevision) &&
    environment.terrainRevision >= 0 &&
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
  const plan: BuildingGrowthPlan = {
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
  };
  return Object.freeze(plan);
}

export function planBuildingGrowthTick(input: {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
  readonly reservedCells?: readonly CellCoord[];
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

  const tickPlan = planSimulationTick(simulation);
  if (!tickPlan.valid) {
    return invalidPlan(buildings, simulation, input.environment, 'building-growth:tick-overflow');
  }

  const afterAbsoluteTick = tickPlan.afterAbsoluteTick;
  const completedIds: string[] = [];
  const dirty: ChunkCoord[] = [];
  const proposed: AuthoritativeBuildingInstance[] = buildings.instances.map((instance) => {
    const authoritative = normalizeBuildingInstance(instance);
    if (
      authoritative.lifecycle === 'construction' &&
      authoritative.constructionCompletesAtTick <= afterAbsoluteTick
    ) {
      completedIds.push(authoritative.instanceId);
      for (const cell of occupiedCellsForBuilding(authoritative)) {
        dirty.push(chunkForCell(cell, input.config));
      }
      return activateCompletedBuilding(authoritative, afterAbsoluteTick);
    }
    return authoritative;
  });

  const startedIds: string[] = [];
  let nextGrowthSequence = simulation.growthSequence;
  if (isDevelopmentEvaluationTick(afterAbsoluteTick)) {
    const intermediate = createBuildingSnapshot(
      { revision: buildings.revision, instances: proposed },
      input.config,
    );
    const selected = selectGrowthBuildingPlacement({
      buildings: intermediate,
      environment: input.environment,
      config: input.config,
      absoluteTick: afterAbsoluteTick,
      growthSequence: simulation.growthSequence,
      ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
    });
    if (selected !== null) {
      nextGrowthSequence += 1;
      const definition = buildingDefinitionForId(selected.definition.id);
      const construction: AuthoritativeBuildingInstance = Object.freeze({
        instanceId: `building:growth:${nextGrowthSequence}`,
        buildingDefinitionId: definition.id,
        buildingDefinitionVersion: definition.version,
        originCell: Object.freeze({ ...selected.instance.originCell }),
        rotationQuarterTurns: selected.instance.rotationQuarterTurns,
        lifecycle: 'construction',
        constructionStartedAtTick: afterAbsoluteTick,
        constructionCompletesAtTick: afterAbsoluteTick + definition.constructionDurationTicks,
      });
      proposed.push(construction);
      startedIds.push(construction.instanceId);
      for (const cell of occupiedCellsForBuilding(construction)) {
        dirty.push(chunkForCell(cell, input.config));
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
    proposedInstances: Object.freeze(proposed.map(normalizeBuildingInstance)),
    startedInstanceIds: frozenStrings(startedIds),
    completedInstanceIds: frozenStrings(completedIds),
    nextGrowthSequence,
    dirtyChunks: frozenChunks(dirty),
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

  const tickPlan = planSimulationTick(input.simulation);
  if (!tickPlan.valid || tickPlan.afterAbsoluteTick !== plan.afterAbsoluteTick) {
    throw new BuildingContractError('building-growth:stale-simulation-plan');
  }
  const simulationCommit = commitSimulationTick(
    input.simulation,
    tickPlan,
    plan.nextGrowthSequence,
  );
  const changed = plan.startedInstanceIds.length > 0 || plan.completedInstanceIds.length > 0;
  const buildings = changed
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
