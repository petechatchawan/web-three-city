import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import {
  buildingFootprintInsideWorld,
  isBuildingRotationQuarterTurns,
  occupiedCellsForBuilding,
} from './building-footprint.js';
import type { BuildingInstance, BuildingSnapshot } from './contracts.js';

const OCCUPANCY = new WeakMap<BuildingSnapshot, ReadonlyMap<string, BuildingInstance>>();
const INSTANCES = new WeakMap<BuildingSnapshot, readonly BuildingInstance[]>();

export interface CreateBuildingSnapshotInput {
  readonly revision: number;
  readonly instances: readonly BuildingInstance[];
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function copyInstance(instance: BuildingInstance): BuildingInstance {
  return Object.freeze({
    instanceId: instance.instanceId,
    buildingDefinitionId: instance.buildingDefinitionId,
    buildingDefinitionVersion: instance.buildingDefinitionVersion,
    originCell: Object.freeze({ x: instance.originCell.x, z: instance.originCell.z }),
    rotationQuarterTurns: instance.rotationQuarterTurns,
  });
}

export function createBuildingSnapshot(
  input: CreateBuildingSnapshotInput,
  config: WorldConfig,
): BuildingSnapshot {
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new RangeError('building-snapshot:invalid-revision');
  }

  const identifiers = new Set<string>();
  const occupancy = new Map<string, BuildingInstance>();
  const instances = input.instances.map(copyInstance);

  for (const instance of instances) {
    if (instance.instanceId.length === 0 || identifiers.has(instance.instanceId)) {
      throw new RangeError('building-snapshot:duplicate-instance-id');
    }
    identifiers.add(instance.instanceId);

    if (!isBuildingRotationQuarterTurns(instance.rotationQuarterTurns)) {
      throw new RangeError('building-snapshot:invalid-rotation');
    }
    const definition = buildingDefinitionForId(instance.buildingDefinitionId);
    if (definition.version !== instance.buildingDefinitionVersion) {
      throw new RangeError('building-snapshot:definition-version-mismatch');
    }
    if (!definition.allowedRotationQuarterTurns.includes(instance.rotationQuarterTurns)) {
      throw new RangeError('building-snapshot:rotation-not-allowed');
    }
    if (!buildingFootprintInsideWorld(instance, config)) {
      throw new RangeError('building-snapshot:footprint-out-of-bounds');
    }

    for (const cell of occupiedCellsForBuilding(instance)) {
      const key = cellKey(cell);
      if (occupancy.has(key)) throw new RangeError('building-snapshot:overlapping-footprint');
      occupancy.set(key, instance);
    }
  }

  const frozenInstances = Object.freeze(
    [...instances].sort((first, second) => first.instanceId.localeCompare(second.instanceId)),
  );
  const snapshot: BuildingSnapshot = Object.freeze({
    revision: input.revision,
    get instances(): readonly BuildingInstance[] {
      return frozenInstances;
    },
  });
  INSTANCES.set(snapshot, frozenInstances);
  OCCUPANCY.set(snapshot, occupancy);
  return snapshot;
}

export function createEmptyBuildingSnapshot(config: WorldConfig): BuildingSnapshot {
  return createBuildingSnapshot({ revision: 0, instances: Object.freeze([]) }, config);
}

export function buildingInstances(snapshot: BuildingSnapshot): readonly BuildingInstance[] {
  return INSTANCES.get(snapshot) ?? snapshot.instances;
}

export function buildingAtCell(
  snapshot: BuildingSnapshot,
  cell: CellCoord,
): BuildingInstance | null {
  if (!Number.isInteger(cell.x) || !Number.isInteger(cell.z)) return null;
  const cached = OCCUPANCY.get(snapshot);
  if (cached !== undefined) return cached.get(cellKey(cell)) ?? null;
  return (
    snapshot.instances.find((instance) =>
      occupiedCellsForBuilding(instance).some(
        (candidate) => candidate.x === cell.x && candidate.z === cell.z,
      ),
    ) ?? null
  );
}

export function buildingOccupiedAt(snapshot: BuildingSnapshot, cell: CellCoord): boolean {
  return buildingAtCell(snapshot, cell) !== null;
}

export function buildingCount(snapshot: BuildingSnapshot): number {
  return buildingInstances(snapshot).length;
}

export function occupiedBuildingCellCount(snapshot: BuildingSnapshot): number {
  const cached = OCCUPANCY.get(snapshot);
  if (cached !== undefined) return cached.size;
  return snapshot.instances.reduce(
    (total, instance) => total + occupiedCellsForBuilding(instance).length,
    0,
  );
}
