import type {
  CellCoord,
  CellRect,
  CellWorldBounds,
  ChunkCoord,
  RegionId,
  VertexCoord,
  WorldXZ,
} from "../domain/coordinates";

export type WorldErrorCode =
  | "WORLD_MAP_DEFINITION_INVALID"
  | "WORLD_REGION_UNKNOWN"
  | "WORLD_REGION_GEOMETRY_INVALID"
  | "WORLD_REGION_PARTITION_INCOMPLETE"
  | "WORLD_REGION_PARTITION_OVERLAP"
  | "WORLD_STARTING_CANDIDATE_INVALID"
  | "WORLD_STARTING_REGION_NOT_ELIGIBLE"
  | "WORLD_SEED_NOT_ACCEPTED"
  | "WORLD_COORD_OUT_OF_BOUNDS";

export type WorldReadResult<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "rejected"; readonly code: WorldErrorCode };

export interface WorldSpatialRead {
  cellToChunk(cell: CellCoord): WorldReadResult<{
    readonly chunk: ChunkCoord;
    readonly local: CellCoord;
  }>;
  ownerChunk(vertex: VertexCoord): WorldReadResult<ChunkCoord>;
  incidentCells(vertex: VertexCoord): WorldReadResult<readonly CellCoord[]>;
  touchingChunks(vertex: VertexCoord): WorldReadResult<readonly ChunkCoord[]>;
  cardinalNeighbors(cell: CellCoord): WorldReadResult<readonly CellCoord[]>;
  intersectingChunks(rect: CellRect): WorldReadResult<readonly ChunkCoord[]>;
  worldPositionToCell(position: WorldXZ): WorldReadResult<CellCoord>;
  cellBounds(cell: CellCoord): WorldReadResult<CellWorldBounds>;
  regionAtCell(cell: CellCoord): WorldReadResult<RegionId>;
  adjacentRegions(region: RegionId): WorldReadResult<readonly RegionId[]>;
}
