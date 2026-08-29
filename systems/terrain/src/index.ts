export {
  MAX_LOGICAL_ELEVATION,
  MIN_LOGICAL_ELEVATION,
  parseLogicalElevation,
} from "./domain/elevation";

export type {
  LogicalElevation,
  TerrainElevationResult,
} from "./domain/elevation";

export type {
  TerrainAuthorityRead,
  TerrainCompleteness,
  TerrainQueryResult,
  TerrainRevision,
} from "./contracts/terrain-read";
