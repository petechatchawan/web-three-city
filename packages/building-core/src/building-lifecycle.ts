import {
  INITIAL_ABSOLUTE_TICK,
  compareMacroHours,
  macroHourDuration,
  macroHourIndex,
  macroHourValue,
} from '@web-three-city/simulation-core';
import type {
  ActiveBuildingInstance,
  AuthoritativeBuildingInstance,
  BuildingInstance,
  BuildingSnapshot,
  ConstructionBuildingInstance,
} from './contracts.js';

import type { MacroHourIndex } from '@web-three-city/simulation-core';

function validMacroHourIndex(value: MacroHourIndex, errorCode: string): MacroHourIndex {
  try {
    return macroHourIndex(macroHourValue(value));
  } catch {
    throw new RangeError(errorCode);
  }
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
      constructionStartedAtMacroHourIndex: instance.constructionStartedAtMacroHourIndex,
      constructionCompletesAtMacroHourIndex: instance.constructionCompletesAtMacroHourIndex,
    });
  }
  if (instance.lifecycle === 'active') {
    return Object.freeze({
      ...base,
      lifecycle: 'active',
      activatedAtMacroHourIndex: instance.activatedAtMacroHourIndex,
    });
  }
  return Object.freeze({
    ...base,
    lifecycle: 'active',
    activatedAtMacroHourIndex: macroHourIndex(INITIAL_ABSOLUTE_TICK),
  });
}

/** @deprecated Use validateBuildingLifecycleAtMacroHour with the current macro-hour index. */
export function validateBuildingLifecycle(instance: AuthoritativeBuildingInstance): void {
  if (instance.lifecycle === 'construction') {
    const startedAt = validMacroHourIndex(
      instance.constructionStartedAtMacroHourIndex,
      'building-lifecycle:invalid-construction',
    );
    const completesAt = validMacroHourIndex(
      instance.constructionCompletesAtMacroHourIndex,
      'building-lifecycle:invalid-construction',
    );
    if (compareMacroHours(completesAt, startedAt) !== 1) {
      throw new RangeError('building-lifecycle:invalid-construction');
    }
    return;
  }
  validMacroHourIndex(instance.activatedAtMacroHourIndex, 'building-lifecycle:invalid-active');
}

export function validateBuildingLifecycleAtMacroHour(
  instance: AuthoritativeBuildingInstance,
  now: MacroHourIndex,
): void {
  const current = validMacroHourIndex(now, 'building-lifecycle:invalid-macro-hour');
  validateBuildingLifecycle(instance);
  if (
    instance.lifecycle === 'construction' &&
    compareMacroHours(instance.constructionCompletesAtMacroHourIndex, current) <= 0
  ) {
    throw new RangeError('building-lifecycle:invalid-construction');
  }
}

export function deriveConstructionStateAtMacroHour(
  instance: AuthoritativeBuildingInstance,
  now: MacroHourIndex,
): 'construction' | 'active' {
  const current = validMacroHourIndex(now, 'building-lifecycle:invalid-macro-hour');
  validateBuildingLifecycle(instance);
  if (instance.lifecycle === 'active') return 'active';
  return compareMacroHours(instance.constructionCompletesAtMacroHourIndex, current) <= 0
    ? 'active'
    : 'construction';
}

export function isBuildingConstructionCompleteAtMacroHour(
  instance: ConstructionBuildingInstance,
  macroHourIndexAtNow: MacroHourIndex,
): boolean {
  const current = validMacroHourIndex(macroHourIndexAtNow, 'building-lifecycle:invalid-macro-hour');
  validateBuildingLifecycle(instance);
  return compareMacroHours(instance.constructionCompletesAtMacroHourIndex, current) <= 0;
}

export function deriveConstructionProgressAtMacroHour(
  instance: ConstructionBuildingInstance,
  macroHourIndexAtNow: MacroHourIndex,
): number {
  const current = validMacroHourIndex(macroHourIndexAtNow, 'building-lifecycle:invalid-macro-hour');
  validateBuildingLifecycle(instance);
  const duration = macroHourDuration(
    macroHourValue(instance.constructionCompletesAtMacroHourIndex) -
      macroHourValue(instance.constructionStartedAtMacroHourIndex),
  );
  const elapsed =
    macroHourValue(current) - macroHourValue(instance.constructionStartedAtMacroHourIndex);
  return Math.max(0, Math.min(1, elapsed / macroHourValue(duration)));
}

/** @deprecated Use deriveConstructionProgressAtMacroHour. */
export function constructionProgressAtMacroHour(
  instance: ConstructionBuildingInstance,
  macroHourIndexAtNow: MacroHourIndex,
): number {
  return deriveConstructionProgressAtMacroHour(instance, macroHourIndexAtNow);
}

export function activateCompletedBuilding(
  instance: ConstructionBuildingInstance,
  activatedAtMacroHourIndex: MacroHourIndex,
): ActiveBuildingInstance {
  const activatedAt = validMacroHourIndex(
    activatedAtMacroHourIndex,
    'building-lifecycle:not-complete',
  );
  validateBuildingLifecycle(instance);
  if (compareMacroHours(activatedAt, instance.constructionCompletesAtMacroHourIndex) < 0) {
    throw new RangeError('building-lifecycle:not-complete');
  }
  return Object.freeze({
    instanceId: instance.instanceId,
    buildingDefinitionId: instance.buildingDefinitionId,
    buildingDefinitionVersion: instance.buildingDefinitionVersion,
    originCell: Object.freeze({ ...instance.originCell }),
    rotationQuarterTurns: instance.rotationQuarterTurns,
    lifecycle: 'active',
    activatedAtMacroHourIndex: activatedAt,
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
