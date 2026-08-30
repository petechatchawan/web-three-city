import type {
  PlanTerraformInput,
  TerraformPreview,
} from "./contracts/terraform-types";
import { planTerraformInternal } from "./application/plan-terraform";

function constructTerraformPlan(input: PlanTerraformInput): TerraformPreview {
  return planTerraformInternal(input);
}

export function planTerraform(input: PlanTerraformInput): TerraformPreview {
  return constructTerraformPlan(input);
}

export type { PlanTerraformInput, TerraformPreview } from "./contracts/terraform-types";
