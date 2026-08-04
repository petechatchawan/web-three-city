import { INITIAL_ABSOLUTE_TICK } from '@web-three-city/simulation-core';
import type {
  ActiveBuildingInstance,
  AuthoritativeBuildingInstance,
  BuildingInstance,
  BuildingSnapshot,
  ConstructionBuildingInstance,
} from './contracts.js';

function validTick(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function normalizeBuildingInstance(
  instance: BuildingInstance,
): AuthoritativeBuildingInstance {
  const base = {
    instanceId: instance.instanceId,
    buildingDefinitionId: instance.buildingDefinitionId,
    buildingDefinitionVersion: instance.buildingDefinitionVersion,
    originCell: Object.freeze({ x: instance.originCell.x, z: instance.originCell.z }),
    rotationQuarterTurns: instance.rotationQuarterTurns,
  } as const;
  if (instance.lifecycle === 'construction') {
    return Object.freeze({
      ...base,
      lifecycle: 'construction',
      constructionStartedAtTick: instance.constructionStartedAtTick,
      constructionCompletesAtTick: instance.constructionCompletesAtTick,
    });
  }
  if (instance.lifecycle === 'active') {
    return Object.freeze({
      ...base,
      lifecycle: 'active',
      activatedAtTick: instance.activatedAtTick,
    });
  }
  return Object.freeze({
    ...base,
    lifecycle: 'active',
    activatedAtTick: INITIAL_ABSOLUTE_TICK,
  });
}

export function validateBuildingLifecycle(instance: AuthoritativeBuildingInstance): void {
  if (instance.lifecycle === 'construction') {
    if (
      !validTick(instance.constructionStartedAtTick) ||
      !validTick(instance.constructionCompletesAtTick) ||
      instance.constructionCompletesAtTick <= instance.constructionStartedAtTick
    ) {
      throw new RangeError('building-lifecycle:invalid-construction');
    }
    return;
  }
  if (!validTick(instance.activatedAtTick)) {
    throw new RangeError('building-lifecycle:invalid-active');
  }
}

export function constructionProgressAtTick(
  instance: ConstructionBuildingInstance,
  absoluteTick: number,
): number {
  if (!validTick(absoluteTick)) throw new RangeError('building-lifecycle:invalid-tick');
  const duration = instance.constructionCompletesAtTick - instance.constructionStartedAtTick;
  return Math.max(0, Math.min(1, (absoluteTick - instance.constructionStartedAtTick) / duration));
}

export function activateCompletedBuilding(
  instance: ConstructionBuildingInstance,
  activatedAtTick: number,
): ActiveBuildingInstance {
  if (!validTick(activatedAtTick) || activatedAtTick < instance.constructionCompletesAtTick) {
    throw new RangeError('building-lifecycle:not-complete');
  }
  return Object.freeze({
    instanceId: instance.instanceId,
    buildingDefinitionId: instance.buildingDefinitionId,
    buildingDefinitionVersion: instance.buildingDefinitionVersion,
    originCell: Object.freeze({ ...instance.originCell }),
    rotationQuarterTurns: instance.rotationQuarterTurns,
    lifecycle: 'active',
    activatedAtTick,
  });
}

export function buildingLifecycleCounts(snapshot: BuildingSnapshot): Readonly<{
  readonly construction: number;
  readonly active: number;
  readonly total: number;
}> {
  let construction = 0;
  let active = 0;
  for (const instance of snapshot.instances) {
    if (instance.lifecycle === 'construction') construction += 1;
    else active += 1;
  }
  return Object.freeze({ construction, active, total: construction + active });
}
