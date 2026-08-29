import type { PreparedWorldDefinition, RegionId } from "@web-three-city/world";
import type { TerrainFieldSource } from "./terrain-composition";

export type TerrainStartingReason =
  | "TERRAIN_START_UNAVAILABLE"
  | "TERRAIN_START_CELL_RELIEF_EXCEEDED"
  | "TERRAIN_START_PATCH_RELIEF_EXCEEDED"
  | "TERRAIN_START_ANCHOR_RELIEF_EXCEEDED";

export interface StartingCandidateEvaluation {
  readonly regionId: RegionId;
  readonly eligible: boolean;
  readonly patchElevationRange: number;
  readonly maxCellCornerRange: number;
  readonly anchorCellCornerRange: number;
  readonly reasons: readonly TerrainStartingReason[];
}

export type TerrainGenerationRejectionCode =
  | "TERRAIN_GENERATION_PROFILE_UNSUPPORTED"
  | "TERRAIN_GENERATION_SEED_INVALID"
  | "TERRAIN_GENERATION_OUTPUT_OUT_OF_RANGE"
  | "TERRAIN_GENERATION_NO_ELIGIBLE_START";

export interface PrepareProductionTerrainInput {
  readonly world: PreparedWorldDefinition;
  readonly seed64: string;
}

export interface PreparedProductionTerrain {
  readonly field: TerrainFieldSource;
  readonly selectedSeed64: string;
  readonly fingerprint: string;
  readonly candidateEvaluations: readonly StartingCandidateEvaluation[];
}

export type TerrainGenerationResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly code: TerrainGenerationRejectionCode;
      readonly detail?: Readonly<Record<string, unknown>>;
    };
