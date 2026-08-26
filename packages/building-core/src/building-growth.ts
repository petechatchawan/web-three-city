import {
  addMacroHours,
  commitSimulationMinute,
  createSimulationSnapshot,
  deriveMacroHourTransition,
  macroHourDuration,
  macroHourValue,
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

type GrowthPreparation = Readonly<{
  buildings: BuildingSnapshot;
  simulation: SimulationSnapshot;
  reason: BuildingGrowthInvalidReason | null;
}>;

function prepareGrowthSnapshots(input: {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly config: WorldConfig;
}): GrowthPreparation {
  let buildings: BuildingSnapshot;
  try {
    buildings = createBuildingSnapshot(input.buildings, input.config);
  } catch {
    return {
      buildings: input.buildings,
      simulation: input.simulation,
      reason: 'building-growth:invalid-building-state',
    };
  }
  try {
    return {
      buildings,
      simulation: createSimulationSnapshot(input.simulation),
      reason: null,
    };
  } catch {
    return {
      buildings,
      simulation: input.simulation,
      reason: 'building-growth:invalid-simulation-state',
    };
  }
}

function normalizeGrowthBuildings(
  buildings: BuildingSnapshot,
  macroHourTransition: MacroHourTransition,
  config: WorldConfig,
): Readonly<{
  proposed: AuthoritativeBuildingInstance[];
  completedIds: string[];
  dirty: ChunkCoord[];
}> {
  const completedIds: string[] = [];
  const dirty: ChunkCoord[] = [];
  const proposed: AuthoritativeBuildingInstance[] = !macroHourTransition.crossed
    ? buildings.instances.map(normalizeBuildingInstance)
    : buildings.instances.map((instance) => {
        const authoritative = normalizeBuildingInstance(instance);
        if (
          authoritative.lifecycle === 'construction' &&
          authoritative.constructionCompletesAtTick <= macroHourTransition.afterMacroHourIndex
        ) {
          completedIds.push(authoritative.instanceId);
          for (const cell of occupiedCellsForBuilding(authoritative))
            dirty.push(chunkForCell(cell, config));
          return activateCompletedBuilding(authoritative, macroHourTransition.afterMacroHourIndex);
        }
        return authoritative;
      });
  return { proposed, completedIds, dirty };
}

function applyScheduledGrowth(input: {
  readonly buildings: BuildingSnapshot;
  readonly proposed: AuthoritativeBuildingInstance[];
  readonly simulation: SimulationSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
  readonly macroHourTransition: MacroHourTransition;
  readonly reservedCells?: readonly CellCoord[];
  readonly growthPolicy?: BuildingGrowthPolicy;
}): Readonly<{
  nextGrowthSequence: number;
  startedIds: string[];
  dirty: ChunkCoord[];
}> {
  const startedIds: string[] = [];
  let nextGrowthSequence = input.simulation.growthSequence;
  if (
    !input.macroHourTransition.crossed ||
    !isDevelopmentEvaluationTick(input.macroHourTransition.afterMacroHourIndex)
  ) {
    return { nextGrowthSequence, startedIds, dirty: [] };
  }
  const intermediate = createBuildingSnapshot(
    { revision: input.buildings.revision, instances: input.proposed },
    input.config,
  );
  const selected = selectGrowthBuildingPlacement({
    buildings: intermediate,
    environment: input.environment,
    config: input.config,
    absoluteTick: input.macroHourTransition.afterMacroHourIndex,
    growthSequence: input.simulation.growthSequence,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
    ...(input.growthPolicy === undefined ? {} : { growthPolicy: input.growthPolicy }),
  });
  if (selected === null) return { nextGrowthSequence, startedIds, dirty: [] };
  nextGrowthSequence += 1;
  const definition = buildingDefinitionForId(selected.definition.id);
  const construction: AuthoritativeBuildingInstance = Object.freeze({
    instanceId: `building:growth:${nextGrowthSequence}`,
    buildingDefinitionId: definition.id,
    buildingDefinitionVersion: definition.version,
    originCell: Object.freeze({ ...selected.instance.originCell }),
    rotationQuarterTurns: selected.instance.rotationQuarterTurns,
    lifecycle: 'construction',
    constructionStartedAtTick: input.macroHourTransition.afterMacroHourIndex,
    constructionCompletesAtTick: addMacroHours(
      input.macroHourTransition.afterMacroHourIndex,
      macroHourDuration(definition.constructionDurationTicks),
    ),
  });
  input.proposed.push(construction);
  startedIds.push(construction.instanceId);
  const dirty = occupiedCellsForBuilding(construction).map((cell) =>
    chunkForCell(cell, input.config),
  );
  return { nextGrowthSequence, startedIds, dirty };
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
  const prepared = prepareGrowthSnapshots(input);
  if (prepared.reason !== null) {
    return invalidPlan(prepared.buildings, prepared.simulation, input.environment, prepared.reason);
  }
  const { buildings, simulation } = prepared;
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
  const normalized = normalizeGrowthBuildings(buildings, macroHourTransition, input.config);
  const scheduled = applyScheduledGrowth({
    buildings,
    proposed: normalized.proposed,
    simulation,
    environment: input.environment,
    config: input.config,
    macroHourTransition,
    ...(input.reservedCells === undefined ? {} : { reservedCells: input.reservedCells }),
    ...(input.growthPolicy === undefined ? {} : { growthPolicy: input.growthPolicy }),
  });

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
    proposedInstances: Object.freeze(normalized.proposed.map(normalizeBuildingInstance)),
    startedInstanceIds: frozenStrings(scheduled.startedIds),
    completedInstanceIds: frozenStrings(normalized.completedIds),
    nextGrowthSequence: scheduled.nextGrowthSequence,
    dirtyChunks: frozenChunks([...normalized.dirty, ...scheduled.dirty]),
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
      macroHourValue(
        deriveMacroHourTransition(
          input.simulation.absoluteGameMinute,
          input.simulation.absoluteGameMinute,
        ).beforeMacroHourIndex,
      ) !== plan.beforeAbsoluteTick)
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
      macroHourValue(
        deriveMacroHourTransition(
          input.simulation.absoluteGameMinute,
          tickPlan.afterAbsoluteGameMinute,
        ).afterMacroHourIndex,
      ) !== plan.afterAbsoluteTick)
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
