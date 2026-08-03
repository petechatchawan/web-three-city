import { buildingOccupiedAt, type BuildingSnapshot } from '@web-three-city/building-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { ZoneInvalidReason, ZoneMutationPlan } from '@web-three-city/zone-core';

export type GameZoneInvalidReason = ZoneInvalidReason | 'zone:building-occupied';

export interface GuardedZoneCandidate {
  readonly corePlan: ZoneMutationPlan;
  readonly previewPlan: ZoneMutationPlan;
  readonly valid: boolean;
  readonly invalidReason: GameZoneInvalidReason | null;
  readonly blockedBuildingCells: readonly CellCoord[];
}

export function guardZonePlanWithBuildings(
  plan: ZoneMutationPlan,
  buildings: BuildingSnapshot,
): GuardedZoneCandidate {
  if (!plan.valid)
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
      blockedBuildingCells: Object.freeze([]),
    });
  const blocked = Object.freeze(
    plan.changedCells
      .filter((cell) => buildingOccupiedAt(buildings, cell))
      .map((cell) => Object.freeze({ ...cell })),
  );
  if (blocked.length > 0)
    return Object.freeze({
      corePlan: plan,
      previewPlan: Object.freeze({ ...plan, valid: false }),
      valid: false,
      invalidReason: 'zone:building-occupied',
      blockedBuildingCells: blocked,
    });
  return Object.freeze({
    corePlan: plan,
    previewPlan: plan,
    valid: true,
    invalidReason: null,
    blockedBuildingCells: Object.freeze([]),
  });
}
