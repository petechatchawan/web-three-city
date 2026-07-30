import { roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import type {
  TerraformInvalidReason,
  TerraformPlan,
} from '@web-three-city/terrain-core';

export type GameTerraformInvalidReason =
  | TerraformInvalidReason
  | 'terraform:road-occupied';

export interface GuardedTerraformPlan {
  readonly corePlan: TerraformPlan;
  readonly previewPlan: TerraformPlan;
  readonly valid: boolean;
  readonly invalidReason: GameTerraformInvalidReason | null;
}

export function guardTerraformPlanWithRoads(
  plan: TerraformPlan,
  roads: RoadSnapshot,
): GuardedTerraformPlan {
  if (!plan.valid) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
    });
  }

  const blocked = plan.affectedCells.some((cell) => roadOccupiedAt(roads, cell));
  if (!blocked) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: true,
      invalidReason: null,
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
  });
}
