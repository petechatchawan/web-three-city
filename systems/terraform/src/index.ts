export type {
  PlanTerraformInput,
  TerraformInvalidReason,
  TerraformOperation,
  TerraformPlan,
  TerraformPreview,
  TerraformVertexMutation,
} from "./contracts/terraform-types";
export {
  buildBrushFootprint,
  type TerraformBrushFootprint,
  type TerraformBrushSize,
} from "./domain/brush-footprint";
export {
  resolveFlattenCorner,
  selectFlattenReference,
  type FlattenReferencePick,
  type FlattenReferenceRejectionReason,
  type FlattenReferenceResult,
  type SelectFlattenReferenceInput,
} from "./domain/flatten-reference";
export { strengthLevels, type TerraformStrength } from "./domain/strength";
