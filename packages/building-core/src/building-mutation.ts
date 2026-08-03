import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitions } from './building-definitions.js';
import { occupiedCellsForBuilding } from './building-footprint.js';
import { resolveBuildingFrontage } from './building-frontage.js';
import {
  buildingAtCell,
  buildingInstances,
  createBuildingSnapshot,
} from './building-snapshot.js';
import {
  BuildingContractError,
  type BuildingDefinition,
  type BuildingDevelopmentEnvironment,
  type BuildingInstance,
  type BuildingInvalidReason,
  type BuildingMutationPlan,
  type BuildingMutationReceipt,
  type BuildingSnapshot,
} from './contracts.js';

const REASON_PRECEDENCE: readonly BuildingInvalidReason[] = Object.freeze([
  'building:invalid-state',
  'building:invalid-environment',
  'building:invalid-cell',
  'building:mixed-zone',
  'building:road-occupied',
  'building:occupied',
  'building:wet-cell',
  'building:unsupported-terrain',
  'building:road-access-required',
  'building:no-compatible-definition',
  'building:no-zoned-lot',
  'building:not-found',
  'building:no-change',
]);

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < config.mapWidth &&
    cell.z < config.mapHeight
  );
}

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function environmentValid(environment: BuildingDevelopmentEnvironment): boolean {
  return (
    Number.isSafeInteger(environment.terrainRevision) &&
    environment.terrainRevision >= 0 &&
    Number.isSafeInteger(environment.waterSourceTerrainRevision) &&
    environment.waterSourceTerrainRevision >= 0 &&
    Number.isSafeInteger(environment.roadRevision) &&
    environment.roadRevision >= 0 &&
    Number.isSafeInteger(environment.zoneRevision) &&
    environment.zoneRevision >= 0 &&
    environment.waterSourceTerrainRevision === environment.terrainRevision
  );
}

function copyInstance(instance: BuildingInstance): BuildingInstance {
  return Object.freeze({
    ...instance,
    originCell: Object.freeze({ x: instance.originCell.x, z: instance.originCell.z }),
  });
}

function frozenInstances(instances: Iterable<BuildingInstance>): readonly BuildingInstance[] {
  return Object.freeze([...instances].map(copyInstance));
}

function frozenChunks(chunks: Iterable<ChunkCoord>): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()]
      .map((chunk) => Object.freeze({ x: chunk.x, z: chunk.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function primaryReason(reasons: ReadonlySet<BuildingInvalidReason>): BuildingInvalidReason {
  return REASON_PRECEDENCE.find((reason) => reasons.has(reason)) ?? 'building:no-change';
}

function sortedDefinitions(zoneId: string): readonly BuildingDefinition[] {
  return Object.freeze(
    buildingDefinitions()
      .filter((definition) =>
        definition.compatibleZoneDefinitionIds.some((candidate) => candidate === zoneId),
      )
      .sort(
        (first, second) =>
          second.selectionPriority - first.selectionPriority ||
          second.footprintWidth * second.footprintDepth -
            first.footprintWidth * first.footprintDepth ||
          first.id.localeCompare(second.id),
      ),
  );
}

function candidateReason(
  instance: BuildingInstance,
  occupied: ReadonlySet<string>,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
): BuildingInvalidReason | null {
  const originZone = environment.zoneDefinitionIdAt(instance.originCell);
  if (originZone === null) return 'building:no-zoned-lot';
  const definition = buildingDefinitions().find(
    (candidate) => candidate.id === instance.buildingDefinitionId,
  );
  if (definition === undefined || !definition.compatibleZoneDefinitionIds.includes(originZone)) {
    return 'building:no-compatible-definition';
  }

  for (const cell of occupiedCellsForBuilding(instance)) {
    if (!validCell(cell, config)) return 'building:invalid-cell';
    if (occupied.has(key(cell))) return 'building:occupied';
    if (environment.zoneDefinitionIdAt(cell) !== originZone) return 'building:mixed-zone';
    if (environment.isRoadOccupied(cell)) return 'building:road-occupied';
    if (!environment.isDry(cell)) return 'building:wet-cell';
    if (environment.surfaceAt(cell).shape !== 'flat') return 'building:unsupported-terrain';
  }
  if (resolveBuildingFrontage(instance, environment) === null) {
    return 'building:road-access-required';
  }
  return null;
}

function createPlan(input: {
  readonly buildings: BuildingSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly operation: 'develop' | 'bulldoze';
  readonly requestedCell: CellCoord | null;
  readonly proposedInstances: readonly BuildingInstance[];
  readonly addedInstances: readonly BuildingInstance[];
  readonly removedInstances: readonly BuildingInstance[];
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly invalidReason: BuildingInvalidReason | null;
}): BuildingMutationPlan {
  return Object.freeze({
    operation: input.operation,
    baseBuildingRevision: input.buildings.revision,
    baseTerrainRevision: input.environment.terrainRevision,
    baseWaterSourceTerrainRevision: input.environment.waterSourceTerrainRevision,
    baseRoadRevision: input.environment.roadRevision,
    baseZoneRevision: input.environment.zoneRevision,
    requestedCell:
      input.requestedCell === null
        ? null
        : Object.freeze({ x: input.requestedCell.x, z: input.requestedCell.z }),
    proposedInstances: frozenInstances(input.proposedInstances),
    addedInstances: frozenInstances(input.addedInstances),
    removedInstances: frozenInstances(input.removedInstances),
    dirtyChunks: frozenChunks(input.dirtyChunks),
    valid: input.invalidReason === null,
    invalidReason: input.invalidReason,
  });
}

export function planBuildingDevelopment(
  buildings: BuildingSnapshot,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
): BuildingMutationPlan {
  let validated: BuildingSnapshot;
  try {
    validated = createBuildingSnapshot(
      { revision: buildings.revision, instances: buildings.instances },
      config,
    );
  } catch {
    return createPlan({
      buildings,
      environment,
      operation: 'develop',
      requestedCell: null,
      proposedInstances: Object.freeze([]),
      addedInstances: Object.freeze([]),
      removedInstances: Object.freeze([]),
      dirtyChunks: Object.freeze([]),
      invalidReason: 'building:invalid-state',
    });
  }
  if (!environmentValid(environment)) {
    return createPlan({
      buildings: validated,
      environment,
      operation: 'develop',
      requestedCell: null,
      proposedInstances: validated.instances,
      addedInstances: Object.freeze([]),
      removedInstances: Object.freeze([]),
      dirtyChunks: Object.freeze([]),
      invalidReason: 'building:invalid-environment',
    });
  }

  const occupied = new Set<string>();
  for (const instance of buildingInstances(validated)) {
    for (const cell of occupiedCellsForBuilding(instance)) occupied.add(key(cell));
  }

  const added: BuildingInstance[] = [];
  const reasons = new Set<BuildingInvalidReason>();
  const dirty: ChunkCoord[] = [];
  let zonedCellCount = 0;
  let sequence = 0;
  const targetRevision = validated.revision + 1;

  try {
    for (let z = 0; z < config.mapHeight; z += 1) {
      for (let x = 0; x < config.mapWidth; x += 1) {
        const originCell = Object.freeze({ x, z });
        if (occupied.has(key(originCell))) continue;
        const zoneId = environment.zoneDefinitionIdAt(originCell);
        if (zoneId === null) continue;
        zonedCellCount += 1;
        const definitions = sortedDefinitions(zoneId);
        if (definitions.length === 0) {
          reasons.add('building:no-compatible-definition');
          continue;
        }

        let accepted: BuildingInstance | null = null;
        for (const definition of definitions) {
          for (const rotation of [...definition.allowedRotationQuarterTurns].sort()) {
            const instance: BuildingInstance = Object.freeze({
              instanceId: `building:${targetRevision}:${sequence + 1}`,
              buildingDefinitionId: definition.id,
              buildingDefinitionVersion: definition.version,
              originCell,
              rotationQuarterTurns: rotation,
            });
            const reason = candidateReason(instance, occupied, environment, config);
            if (reason === null) {
              accepted = instance;
              break;
            }
            reasons.add(reason);
          }
          if (accepted !== null) break;
        }
        if (accepted === null) continue;

        sequence += 1;
        added.push(accepted);
        for (const cell of occupiedCellsForBuilding(accepted)) {
          occupied.add(key(cell));
          dirty.push(chunkForCell(cell, config));
        }
      }
    }
  } catch {
    reasons.add('building:invalid-environment');
  }

  const invalidReason: BuildingInvalidReason | null =
    added.length > 0
      ? null
      : zonedCellCount === 0
        ? 'building:no-zoned-lot'
        : primaryReason(reasons);
  return createPlan({
    buildings: validated,
    environment,
    operation: 'develop',
    requestedCell: null,
    proposedInstances: [...validated.instances, ...added],
    addedInstances: added,
    removedInstances: Object.freeze([]),
    dirtyChunks: dirty,
    invalidReason,
  });
}

export function planBuildingBulldoze(
  buildings: BuildingSnapshot,
  cell: CellCoord,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
): BuildingMutationPlan {
  let validated: BuildingSnapshot;
  try {
    validated = createBuildingSnapshot(
      { revision: buildings.revision, instances: buildings.instances },
      config,
    );
  } catch {
    return createPlan({
      buildings,
      environment,
      operation: 'bulldoze',
      requestedCell: cell,
      proposedInstances: Object.freeze([]),
      addedInstances: Object.freeze([]),
      removedInstances: Object.freeze([]),
      dirtyChunks: Object.freeze([]),
      invalidReason: 'building:invalid-state',
    });
  }
  if (!environmentValid(environment)) {
    return createPlan({
      buildings: validated,
      environment,
      operation: 'bulldoze',
      requestedCell: cell,
      proposedInstances: validated.instances,
      addedInstances: Object.freeze([]),
      removedInstances: Object.freeze([]),
      dirtyChunks: Object.freeze([]),
      invalidReason: 'building:invalid-environment',
    });
  }
  if (!validCell(cell, config)) {
    return createPlan({
      buildings: validated,
      environment,
      operation: 'bulldoze',
      requestedCell: cell,
      proposedInstances: validated.instances,
      addedInstances: Object.freeze([]),
      removedInstances: Object.freeze([]),
      dirtyChunks: Object.freeze([]),
      invalidReason: 'building:invalid-cell',
    });
  }

  const removed = buildingAtCell(validated, cell);
  if (removed === null) {
    return createPlan({
      buildings: validated,
      environment,
      operation: 'bulldoze',
      requestedCell: cell,
      proposedInstances: validated.instances,
      addedInstances: Object.freeze([]),
      removedInstances: Object.freeze([]),
      dirtyChunks: Object.freeze([]),
      invalidReason: 'building:not-found',
    });
  }
  const dirty = occupiedCellsForBuilding(removed).map((occupiedCell) =>
    chunkForCell(occupiedCell, config),
  );
  return createPlan({
    buildings: validated,
    environment,
    operation: 'bulldoze',
    requestedCell: cell,
    proposedInstances: validated.instances.filter(
      (instance) => instance.instanceId !== removed.instanceId,
    ),
    addedInstances: Object.freeze([]),
    removedInstances: Object.freeze([removed]),
    dirtyChunks: dirty,
    invalidReason: null,
  });
}

function sameInstance(first: BuildingInstance, second: BuildingInstance): boolean {
  return (
    first.instanceId === second.instanceId &&
    first.buildingDefinitionId === second.buildingDefinitionId &&
    first.buildingDefinitionVersion === second.buildingDefinitionVersion &&
    first.originCell.x === second.originCell.x &&
    first.originCell.z === second.originCell.z &&
    first.rotationQuarterTurns === second.rotationQuarterTurns
  );
}

function sameInstances(
  first: readonly BuildingInstance[],
  second: readonly BuildingInstance[],
): boolean {
  return (
    first.length === second.length &&
    first.every((instance, index) => sameInstance(instance, second[index]!))
  );
}

export function commitBuildingMutation(
  buildings: BuildingSnapshot,
  plan: BuildingMutationPlan,
  environment: BuildingDevelopmentEnvironment,
  config: WorldConfig,
): { readonly snapshot: BuildingSnapshot; readonly receipt: BuildingMutationReceipt } {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new BuildingContractError('building:invalid-plan');
  }
  if (buildings.revision !== plan.baseBuildingRevision) {
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
  if (!environmentValid(environment)) {
    throw new BuildingContractError('building:incoherent-world-revision');
  }

  try {
    const verified =
      plan.operation === 'develop'
        ? planBuildingDevelopment(buildings, environment, config)
        : planBuildingBulldoze(buildings, plan.requestedCell!, environment, config);
    if (!verified.valid || !sameInstances(verified.proposedInstances, plan.proposedInstances)) {
      throw new BuildingContractError('building:invalid-proposed-state');
    }
    const snapshot = createBuildingSnapshot(
      { revision: buildings.revision + 1, instances: verified.proposedInstances },
      config,
    );
    const receipt: BuildingMutationReceipt = Object.freeze({
      beforeRevision: buildings.revision,
      afterRevision: snapshot.revision,
      operation: plan.operation,
      addedInstanceCount: plan.addedInstances.length,
      removedInstanceCount: plan.removedInstances.length,
      addedCellCount: plan.addedInstances.reduce(
        (total, instance) => total + occupiedCellsForBuilding(instance).length,
        0,
      ),
      removedCellCount: plan.removedInstances.reduce(
        (total, instance) => total + occupiedCellsForBuilding(instance).length,
        0,
      ),
      dirtyChunks: frozenChunks(plan.dirtyChunks),
    });
    return Object.freeze({ snapshot, receipt });
  } catch (error) {
    if (error instanceof BuildingContractError) throw error;
    throw new BuildingContractError('building:invalid-proposed-state');
  }
}
