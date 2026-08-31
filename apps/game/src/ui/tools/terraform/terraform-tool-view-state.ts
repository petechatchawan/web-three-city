import type {
  TerraformBrushSize,
  TerraformOperation,
  TerraformStrength,
} from "@web-three-city/terraform";

export interface TerraformToolViewState {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly strength: TerraformStrength;
  readonly flattenTargetMeters?: number;
  readonly undoDepth: number;
  readonly validity: "idle" | "valid" | "invalid";
  readonly message?: string;
}

export function createTerraformToolViewState(): TerraformToolViewState {
  return Object.freeze({
    operation: "raise",
    brushSize: 1,
    strength: "normal",
    undoDepth: 0,
    validity: "idle",
  });
}
