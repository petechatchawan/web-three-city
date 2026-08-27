import {
  addMacroHours,
  compareMacroHours,
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import { occupiedCellsForBuilding } from './building-footprint.js';
import { activateCompletedBuilding, normalizeBuildingInstance } from './building-lifecycle.js';
import {
  commitBuildingMutation as commitLegacyBuildingMutation,
  planBuildingDevelopment as planLegacyBuildingDevelopment,
} from './building-mutation.js';
import { selectGrowthBuildingPlacement } from './building-selection.js';
import { createBuildingSnapshot } from './building-snapshot.js';
import {
  BuildingContractError,
  type AuthoritativeBuildingInstance,
  type BuildingDevelopmentEnvironment,
  type BuildingInstance,
  type BuildingMutationPlan,
  type BuildingMutationReceipt,
  type BuildingSnapshot,
} from './contracts.js';

export interface AutomaticBuildingGrowthContext {
  readonly macroHourIndex: MacroHourIndex;
  readonly growthSequence: number;
  readonly evaluation: boolean;
}

let automaticContext: AutomaticBuildingGrowthContext | null = null;
let suppressNextBuildingUndo = false;
const automaticPlans = new WeakSet<object>();

function normalizedMacroHourIndex(value: MacroHourIndex): MacroHourIndex {
  try {
    return macroHourIndex(macroHourValue(value));
  } catch {
    throw new RangeError('building-growth-runtime:invalid-context');
  }
}

export function configureAutomaticBuildingGrowth(
  context: AutomaticBuildingGrowthContext | null,
): void {
  if (context === null) {
    automaticContext = null;
    return;
  }
  const macroHourIndexValue = normalizedMacroHourIndex(context.macroHourIndex);
  if (!Number.isSafeInteger(context.growthSequence) || context.growthSequence < 0) {
    throw new RangeError('building-growth-runtime:invalid-context');
  }
  automaticContext = Object.freeze({ ...context, macroHourIndex: macroHourIndexValue });
}

export function consumeAutomaticBuildingUndoSuppression(): boolean {
  const value = suppressNextBuildingUndo;
  suppressNextBuildingUndo = false;
  return value;
}

function freezeChunks(chunks: Iterable<ChunkCoord>): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()]
      .sort((a, b) => a.z - b.z || a.x - b.x)
      .map((chunk) => Object.freeze({ ...chunk })),
  );
}

function copyInstance(instance: BuildingInstance): AuthoritativeBuildingInstance {
  return normalizeBuildingInstance(instance);
}

function affectedCellCount(instances: readonly BuildingInstance[]): number {
  return instances.reduce(
    (total, instance) => total + occupiedCellsForBuilding(instance).length,
    0,
  );
}

function automaticPlan(
  snapshot: BuildingSnapshot,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
  context: AutomaticBuildingGrowthContext,
): BuildingMutationPlan {
  const dirty: ChunkCoord[] = [];
  const completed: AuthoritativeBuildingInstance[] = [];
  let changed = false;
  for (const rawInstance of snapshot.instances) {
    const instance = normalizeBuildingInstance(rawInstance);
    if (
      instance.lifecycle === 'construction' &&
      compareMacroHours(instance.constructionCompletesAtMacroHourIndex, context.macroHourIndex) <= 0
    ) {
      const active = activateCompletedBuilding(instance, context.macroHourIndex);
      completed.push(active);
      changed = true;
      for (const cell of occupiedCellsForBuilding(active)) {
        dirty.push(chunkForCell(cell, config));
      }
    } else {
      completed.push(instance);
    }
  }

  const staged = createBuildingSnapshot(
    { revision: snapshot.revision, instances: completed },
    config,
  );
  const added: AuthoritativeBuildingInstance[] = [];
  if (context.evaluation) {
    const selected = selectGrowthBuildingPlacement({
      buildings: staged,
      environment,
      config,
      macroHourIndex: context.macroHourIndex,
      growthSequence: context.growthSequence,
    });
    if (selected !== null) {
      const definition = buildingDefinitionForId(selected.definition.id);
      const construction: AuthoritativeBuildingInstance = Object.freeze({
        instanceId: `building:growth:${context.growthSequence + 1}`,
        buildingDefinitionId: definition.id,
        buildingDefinitionVersion: definition.version,
        originCell: Object.freeze({ ...selected.instance.originCell }),
        rotationQuarterTurns: selected.instance.rotationQuarterTurns,
        lifecycle: 'construction',
        constructionStartedAtMacroHourIndex: context.macroHourIndex,
        constructionCompletesAtMacroHourIndex: addMacroHours(
          context.macroHourIndex,
          definition.constructionDurationMacroHours,
        ),
      });
      completed.push(construction);
      added.push(construction);
      changed = true;
      for (const cell of occupiedCellsForBuilding(construction)) {
        dirty.push(chunkForCell(cell, config));
      }
    }
  }

  const plan: BuildingMutationPlan = Object.freeze({
    operation: 'develop',
    baseBuildingRevision: snapshot.revision,
    baseTerrainRevision: environment.terrainRevision,
    baseWaterSourceTerrainRevision: environment.waterSourceTerrainRevision,
    baseRoadRevision: environment.roadRevision,
    baseZoneRevision: environment.zoneRevision,
    requestedCell: null,
    proposedInstances: Object.freeze(completed.map(copyInstance)),
    addedInstances: Object.freeze(added.map(copyInstance)),
    removedInstances: Object.freeze([]),
    dirtyChunks: freezeChunks(dirty),
    valid: changed,
    invalidReason: changed ? null : 'building:no-change',
  });
  if (changed) automaticPlans.add(plan);
  return plan;
}

export function planBuildingDevelopment(
  snapshot: BuildingSnapshot,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
): BuildingMutationPlan {
  return automaticContext === null
    ? planLegacyBuildingDevelopment(snapshot, environment, config)
    : automaticPlan(snapshot, environment, config, automaticContext);
}

export function commitBuildingMutation(
  snapshot: BuildingSnapshot,
  plan: BuildingMutationPlan,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
): Readonly<{
  readonly snapshot: BuildingSnapshot;
  readonly receipt: BuildingMutationReceipt;
}> {
  if (!automaticPlans.has(plan)) {
    return commitLegacyBuildingMutation(snapshot, plan, environment, config);
  }
  if (!plan.valid || plan.invalidReason !== null) {
    throw new BuildingContractError('building:invalid-plan');
  }
  if (snapshot.revision !== plan.baseBuildingRevision) {
    throw new BuildingContractError('building:stale-building-plan');
  }
  if (environment.terrainRevision !== plan.baseTerrainRevision) {
    throw new BuildingContractError('building:stale-terrain-plan');
  }
  if (environment.waterSourceTerrainRevision !== plan.baseWaterSourceTerrainRevision) {
    throw new BuildingContractError('building:stale-water-plan');
  }
  if (environment.roadRevision !== plan.baseRoadRevision) {
    throw new BuildingContractError('building:stale-road-plan');
  }
  if (environment.zoneRevision !== plan.baseZoneRevision) {
    throw new BuildingContractError('building:stale-zone-plan');
  }

  const next = createBuildingSnapshot(
    {
      revision: snapshot.revision + 1,
      instances: plan.proposedInstances,
    },
    config,
  );
  suppressNextBuildingUndo = true;
  return Object.freeze({
    snapshot: next,
    receipt: Object.freeze({
      beforeRevision: snapshot.revision,
      afterRevision: next.revision,
      operation: plan.operation,
      addedInstanceCount: plan.addedInstances.length,
      removedInstanceCount: plan.removedInstances.length,
      addedCellCount: affectedCellCount(plan.addedInstances),
      removedCellCount: affectedCellCount(plan.removedInstances),
      dirtyChunks: plan.dirtyChunks,
    }),
  });
}

export function automaticGrowthProbeCell(config: WorldConfig): CellCoord {
  return Object.freeze({
    x: Math.floor(config.mapWidth / 2),
    z: Math.floor(config.mapHeight / 2),
  });
}
