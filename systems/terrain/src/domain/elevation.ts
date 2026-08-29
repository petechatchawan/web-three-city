export const MIN_LOGICAL_ELEVATION = -4096;
export const MAX_LOGICAL_ELEVATION = 4096;

export type LogicalElevation = number & {
  readonly __logicalElevationBrand: "LogicalElevation";
};

export type TerrainElevationResult =
  | { readonly status: "success"; readonly value: LogicalElevation }
  | {
      readonly status: "rejected";
      readonly code:
        | "TERRAIN_ELEVATION_INVALID"
        | "TERRAIN_ELEVATION_OUT_OF_RANGE";
    };

export function parseLogicalElevation(value: number): TerrainElevationResult {
  if (!Number.isInteger(value)) {
    return { status: "rejected", code: "TERRAIN_ELEVATION_INVALID" };
  }

  if (value < MIN_LOGICAL_ELEVATION || value > MAX_LOGICAL_ELEVATION) {
    return { status: "rejected", code: "TERRAIN_ELEVATION_OUT_OF_RANGE" };
  }

  return { status: "success", value: value as LogicalElevation };
}
