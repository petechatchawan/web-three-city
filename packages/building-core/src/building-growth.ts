import {
  commitSimulationMinute,
  createSimulationSnapshot,
  deriveMacroHourTransition,
  isDevelopmentEvaluationTick,
  isMacroHourTransition,
  planSimulationMinute,
  type MacroHourTransition,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import { occupiedCellsForBuilding } from './building-footprint.js';
import { activateCompletedBuilding, normalizeBuildingInstance } from './building-lifecycle.js';
import { selectGrowthBuildingPlacement } from './building-selection.js';
import { createBuildingSnapshot } from './building-snapshot.js';
import type { BuildingGrowthPolicy } from './growth-policy.js';
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
  return Object.freeze({
    baseBuildingRevision: buildings.revision,
    baseSimulationRevision: simulation.revision,
    baseTerrainRevision: environment.terrainRevision,
    baseWaterSourceTerrainRevision: environment.waterSourceTerrainRevision,
    baseRoadRevision: environment.roadRevision,
    baseZoneRevision: environment.zoneRevision,
    beforeAbsoluteTick: deriveMacroHourTransition(
      simulation.absoluteGameMinute,
      simulation.absoluteGameMinute,
    ).beforeMacroHourIndex,
    afterAbsoluteTick: deriveMacroHourTransition(
      simulation.absoluteGameMinute,
      simulation.absoluteGameMinute,
    ).afterMacroHourIndex,
    macroHourTransition: deriveMacroHourTransition(
      simulation.absoluteGameMinute,
      simulation.absoluteGameMinute,
    ),
    simulationAdvanceOwnedByBuilding: false,
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
  readonly macroHourTransition?: MacroHourTransition;
  readonly reservedCells?: readonly CellCoord[];
  readonly growthPolicy?: BuildingGrowthPolicy;
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
  const tickPlan = planSimulationMinute(simulation);
  if (!tickPlan.valid) {
    return invalidPlan(buildings, simulation, input.environment, 'building-growth:tick-overflow');
  }

  const simulationAdvanceOwnedByBuilding = input.macroHourTransition === undefined;
  const macroHourTransition =
    input.macroHourTransition ??
    deriveMacroHourTransition(simulation.absoluteGameMinute, tickPlan.afterAbsoluteGameMinute);
  if (!isMacroHourTransition(macroHourTransition)) {
    return invalidPlan(
      buildings,
      simulation,
      input.environment,
      'building-growth:invalid-simulation-state',
    );
  }

  const afterAbsoluteTick = macroHourTransition.afterMacroHourIndex;
  const completedIds: string[] = [];
  const dirty: ChunkCoord[] = [];
  const proposed: AuthoritativeBuildingInstance[] = !macroHourTransition.crossed
    ? buildings.instances.map(normalizeBuildingInstance)
    : buildings.instances.map((instance) => {
        const authoritative = normalizeBuildingInstance(instance);
        if (
          authoritative.lifecycle === 'construction' &&
          authoritative.constructionCompletesAtTick <= afterAbsoluteTick
        ) {
          completedIds.push(authoritative.instanceId);
          for (const cell of occupiedCellsForBuilding(authoritative))
            dirty.push(chunkForCell(cell, input.config));
          return activateCompletedBuilding(authoritative, afterAbsoluteTick);
        }
        return authoritative;
      });

  const startedIds: string[] = [];
  let nextGrowthSequence = simulation.growthSequence;
  if (macroHourTransition.crossed && isDevelopmentEvaluationTick(afterAbsoluteTick)) {
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
      ...(input.growthPolicy === undefined ? {} : { growthPolicy: input.growthPolicy }),
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
      for (const cell of occupiedCellsForBuilding(construction))
        dirty.push(chunkForCell(cell, input.config));
    }
  }

  return Object.freeze({
    baseBuildingRevision: buildings.revision,
    baseSimulationRevision: simulation.revision,
    baseTerrainRevision: input.environment.terrainRevision,
    baseWaterSourceTerrainRevision: input.environment.waterSourceTerrainRevision,
    baseRoadRevision: input.environment.roadRevision,
    baseZoneRevision: input.environment.zoneRevision,
    beforeAbsoluteTick: macroHourTransition.beforeMacroHourIndex,
    afterAbsoluteTick,
    macroHourTransition,
    simulationAdvanceOwnedByBuilding,
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
  if (!plan.valid || plan.invalidReason !== null)
    throw new BuildingContractError('building-growth:invalid-plan');
  if (input.buildings.revision !== plan.baseBuildingRevision)
    throw new BuildingContractError('building:stale-building-plan');
  if (
    input.simulation.revision !== plan.baseSimulationRevision ||
    (plan.simulationAdvanceOwnedByBuilding &&
      deriveMacroHourTransition(
        input.simulation.absoluteGameMinute,
        input.simulation.absoluteGameMinute,
      ).beforeMacroHourIndex !== plan.beforeAbsoluteTick)
  ) {
    throw new BuildingContractError('building-growth:stale-simulation-plan');
  }
  if (input.environment.terrainRevision !== plan.baseTerrainRevision)
    throw new BuildingContractError('building:stale-terrain-plan');
  if (input.environment.waterSourceTerrainRevision !== plan.baseWaterSourceTerrainRevision)
    throw new BuildingContractError('building:stale-water-plan');
  if (input.environment.roadRevision !== plan.baseRoadRevision)
    throw new BuildingContractError('building:stale-road-plan');
  if (input.environment.zoneRevision !== plan.baseZoneRevision)
    throw new BuildingContractError('building:stale-zone-plan');
  const tickPlan = planSimulationMinute(input.simulation);
  if (
    plan.simulationAdvanceOwnedByBuilding &&
    (!tickPlan.valid ||
      deriveMacroHourTransition(
        input.simulation.absoluteGameMinute,
        tickPlan.afterAbsoluteGameMinute,
      ).afterMacroHourIndex !== plan.afterAbsoluteTick)
  ) {
    throw new BuildingContractError('building-growth:stale-simulation-plan');
  }
  const simulationCommit = plan.simulationAdvanceOwnedByBuilding
    ? commitSimulationMinute(input.simulation, tickPlan, plan.nextGrowthSequence)
    : { snapshot: input.simulation };
  const changed = plan.startedInstanceIds.length > 0 || plan.completedInstanceIds.length > 0;
  const buildings = changed
    ? createBuildingSnapshot(
        { revision: input.buildings.revision + 1, instances: plan.proposedInstances },
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
      beforeAbsoluteTick: plan.beforeAbsoluteTick,
      afterAbsoluteTick: plan.afterAbsoluteTick,
      startedInstanceIds: plan.startedInstanceIds,
      completedInstanceIds: plan.completedInstanceIds,
      dirtyChunks: plan.dirtyChunks,
    }),
  });
}
