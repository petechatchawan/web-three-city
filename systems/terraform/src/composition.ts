import type {
  PlanTerraformInput,
  TerraformPreview,
} from "./contracts/terraform-types";
import { planTerraformInternal } from "./application/plan-terraform";

export function planTerraform(input: PlanTerraformInput): TerraformPreview {
  return planTerraformInternal(input);
}

export type { PlanTerraformInput, TerraformPreview } from "./contracts/terraform-types";
