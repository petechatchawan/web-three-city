import type {
  CellCoord,
  ChunkCoord,
  MapDefinitionRead,
  MapStateRead,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import type {
  LogicalElevation,
  TerrainAuthorityRead,
  TerrainRevision,
} from "@web-three-city/terrain";
import type { TerraformBrushSize } from "../domain/brush-footprint";
import type { TerraformStrength } from "../domain/strength";

export type TerraformOperation = "raise" | "lower" | "flatten";
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

export interface PlanTerraformInput {
  readonly operation: TerraformOperation;
  readonly targetCell: CellCoord;
  readonly brushSize: TerraformBrushSize;
  readonly strength: TerraformStrength;
  readonly flattenTarget?: LogicalElevation;
  readonly mapDefinition: MapDefinitionRead;
  readonly mapState: MapStateRead;
  readonly spatial: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}

export interface TerraformTerrainInvalidation {
  readonly touchingLogicalChunks: readonly ChunkCoord[];
}

export interface TerraformUndoEntry {
  readonly inverseEdits: readonly {
    readonly vertex: VertexCoord;
    readonly elevation: LogicalElevation;
  }[];
}

export interface TerraformUndoHistory {
  depth(): number;
  expectedTerrainRevision(): TerrainRevision;
  recordCommit(plan: TerraformPlan, newRevision: TerrainRevision): void;
  peekUndo(currentRevision: TerrainRevision): TerraformUndoEntry | undefined;
  recordUndo(newRevision: TerrainRevision): void;
  synchronizeExternalRevision(currentRevision: TerrainRevision): void;
  clear(): void;
}
