import type { CellCoord, VertexCoord } from "@web-three-city/world";
import type { LogicalElevation, TerrainRevision } from "@web-three-city/terrain";

export type TerraformOperation = "raise" | "lower" | "flatten";
export type TerraformBrushSize = 1 | 3 | 5;
export type TerraformStrength = "fine" | "normal" | "strong";
export type TerraformInvalidReason =
  | "OUT_OF_WORLD"
  | "LOCKED_REGION"
  | "TERRAIN_UNAVAILABLE"
  | "ELEVATION_LIMIT"
  | "FLATTEN_TARGET_NOT_SELECTED"
  | "STALE_TERRAIN_REVISION";

export interface TerraformVertexMutation {
  readonly vertex: VertexCoord;
  readonly previousElevation: LogicalElevation;
  readonly desiredElevation: LogicalElevation;
}

export interface TerraformPlan {
  readonly operation: TerraformOperation;
  readonly targetCell: CellCoord;
  readonly footprintCells: readonly CellCoord[];
  readonly influenceCells: readonly CellCoord[];
  readonly edits: readonly TerraformVertexMutation[];
  readonly expectedTerrainRevision: TerrainRevision;
}

export type TerraformPreview =
  | { readonly status: "valid"; readonly plan: TerraformPlan }
  | {
      readonly status: "invalid";
      readonly operation: TerraformOperation;
      readonly targetCell?: CellCoord;
      readonly footprintCells: readonly CellCoord[];
      readonly reason: TerraformInvalidReason;
      readonly expectedTerrainRevision: TerrainRevision;
    };
