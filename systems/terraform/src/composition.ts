import type { TerrainRevision } from "@web-three-city/terrain";
import type {
  PlanTerraformInput,
  TerraformPreview,
  TerraformUndoHistory,
} from "./contracts/terraform-types";
import type {
  CreateTerraformThreeOverlayInput,
  TerraformThreeOverlay,
} from "./contracts/terraform-three";
import { planTerraformInternal } from "./application/plan-terraform";
import { createTerraformUndoHistoryInternal } from "./application/undo-history";
import { createTerraformThreeOverlayInternal } from "./presentation/three/terraform-three-overlay";

function constructTerraformPlan(input: PlanTerraformInput): TerraformPreview {
  return planTerraformInternal(input);
}

function constructTerraformUndoHistory(
  initialRevision: TerrainRevision,
): TerraformUndoHistory {
  return createTerraformUndoHistoryInternal(initialRevision);
}

function constructTerraformThreeOverlay(
  input: CreateTerraformThreeOverlayInput,
): TerraformThreeOverlay {
  return createTerraformThreeOverlayInternal(input);
}

export function planTerraform(input: PlanTerraformInput): TerraformPreview {
  return constructTerraformPlan(input);
}

export function createTerraformUndoHistory(
  initialRevision: TerrainRevision,
): TerraformUndoHistory {
  return constructTerraformUndoHistory(initialRevision);
}

export function createTerraformThreeOverlay(
  input: CreateTerraformThreeOverlayInput,
): TerraformThreeOverlay {
  return constructTerraformThreeOverlay(input);
}

export type {
  PlanTerraformInput,
  TerraformPreview,
  TerraformUndoHistory,
} from "./contracts/terraform-types";
export type {
  CreateTerraformThreeOverlayInput,
  TerraformThreeOverlay,
  TerraformThreeOverlayConfig,
} from "./contracts/terraform-three";
