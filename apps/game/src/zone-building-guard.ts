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

function blockedBuildingCells(
  plan: ZoneMutationPlan,
  buildings: BuildingSnapshot,
): readonly CellCoord[] {
  const unique = new Map<string, CellCoord>();
  for (const cell of plan.requestedCells) {
    if (buildingOccupiedAt(buildings, cell)) unique.set(`${cell.x}:${cell.z}`, cell);
  }
  return Object.freeze(
    [...unique.values()]
      .map((cell) => Object.freeze({ x: cell.x, z: cell.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

export function guardZonePlanWithBuildings(
  plan: ZoneMutationPlan,
  buildings: BuildingSnapshot,
): GuardedZoneCandidate {
  const blocked = blockedBuildingCells(plan, buildings);
  if (blocked.length > 0) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan.valid ? Object.freeze({ ...plan, valid: false }) : plan,
      valid: false,
      invalidReason: 'zone:building-occupied',
      blockedBuildingCells: blocked,
    });
  }
  if (!plan.valid) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
      blockedBuildingCells: Object.freeze([]),
    });
  }
  return Object.freeze({
    corePlan: plan,
    previewPlan: plan,
    valid: true,
    invalidReason: null,
    blockedBuildingCells: Object.freeze([]),
  });
}
