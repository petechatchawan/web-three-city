import type { TerrainRevision } from "@web-three-city/terrain";
import type {
  PlanTerraformInput,
  TerraformPreview,
  TerraformUndoHistory,
} from "./contracts/terraform-types";
import { planTerraformInternal } from "./application/plan-terraform";
import { createTerraformUndoHistoryInternal } from "./application/undo-history";

function constructTerraformPlan(input: PlanTerraformInput): TerraformPreview {
  return planTerraformInternal(input);
}

function constructTerraformUndoHistory(
  initialRevision: TerrainRevision,
): TerraformUndoHistory {
  return createTerraformUndoHistoryInternal(initialRevision);
}

export function planTerraform(input: PlanTerraformInput): TerraformPreview {
  return constructTerraformPlan(input);
}

export function createTerraformUndoHistory(
  initialRevision: TerrainRevision,
): TerraformUndoHistory {
  return constructTerraformUndoHistory(initialRevision);
}

export type {
  PlanTerraformInput,
  TerraformPreview,
  TerraformUndoHistory,
} from "./contracts/terraform-types";
