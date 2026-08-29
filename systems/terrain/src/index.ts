export {
  LOGICAL_ELEVATION_METERS,
  MAX_LOGICAL_ELEVATION,
  MIN_LOGICAL_ELEVATION,
  logicalElevationToMeters,
  parseLogicalElevation,
} from "./domain/elevation";

export type {
  LogicalElevation,
  TerrainElevationResult,
} from "./domain/elevation";

export type { TerrainTriangle } from "./domain/surface";

export type {
  CellSurfaceRead,
  SurfaceSampleRead,
  TerrainAuthorityRead,
  TerrainCompleteness,
  TerrainQueryResult,
  TerrainRevision,
} from "./contracts/terrain-read";

export type {
  TerrainChunkSnapshot,
  TerrainStateSnapshotV1,
} from "./contracts/snapshot";
