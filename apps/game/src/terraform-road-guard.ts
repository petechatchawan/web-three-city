import { roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import type { TerraformInvalidReason, TerraformPlan } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';

export type GameTerraformInvalidReason = TerraformInvalidReason | 'terraform:road-occupied';

export interface GuardedTerraformCandidate {
  readonly corePlan: TerraformPlan;
  readonly previewPlan: TerraformPlan;
  readonly valid: boolean;
  readonly invalidReason: GameTerraformInvalidReason | null;
  readonly blockedRoadCells: readonly CellCoord[];
}

export type GuardedTerraformPlan = GuardedTerraformCandidate;

const EMPTY_BLOCKED_ROAD_CELLS: readonly CellCoord[] = Object.freeze([]);

function blockedRoadCellsFor(plan: TerraformPlan, roads: RoadSnapshot): readonly CellCoord[] {
  return Object.freeze(
    plan.affectedCells
      .filter((cell) => roadOccupiedAt(roads, cell))
      .map((cell) => Object.freeze({ x: cell.x, z: cell.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

export function guardTerraformPlanWithRoads(
  plan: TerraformPlan,
  roads: RoadSnapshot,
): GuardedTerraformCandidate {
  if (!plan.valid) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
      blockedRoadCells: EMPTY_BLOCKED_ROAD_CELLS,
    });
  }

  const blockedRoadCells = blockedRoadCellsFor(plan, roads);
  if (blockedRoadCells.length === 0) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: true,
      invalidReason: null,
      blockedRoadCells: EMPTY_BLOCKED_ROAD_CELLS,
    });
  }

  const previewPlan: TerraformPlan = Object.freeze({
    ...plan,
    valid: false,
  });
  return Object.freeze({
    corePlan: plan,
    previewPlan,
    valid: false,
    invalidReason: 'terraform:road-occupied',
    blockedRoadCells,
  });
}
