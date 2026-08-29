import type {
  CellCoord,
  CellRect,
  CellWorldBounds,
  ChunkCoord,
  MapDefinitionId,
  RegionId,
  StartingCandidate,
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
  | "WORLD_COORD_OUT_OF_BOUNDS";

export type WorldReadResult<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "rejected"; readonly code: WorldErrorCode };

export type WorldConstructionResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly code: WorldErrorCode;
      readonly detail?: Readonly<Record<string, unknown>>;
    };

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

export interface MapDefinitionRead {
  readonly mapDefinitionId: "web-three-city-production";
  readonly profileId: "production-v1";
  readonly profileVersion: 1;
  readonly widthCells: 512;
  readonly heightCells: 512;
  readonly cellSizeMeters: 8;
  readonly logicalChunkSizeCells: 32;
  readonly terrainGenerationProfileId: "balanced-temperate-generation";
  readonly terrainGenerationProfileVersion: 2;
  readonly regionIds: readonly RegionId[];
  readonly startingCandidates: readonly StartingCandidate[];
}

export interface PreparedWorldDefinition {
  readonly mapDefinition: MapDefinitionRead;
  readonly spatial: WorldSpatialRead;
}

export interface CreateInitialWorldInput {
  readonly prepared: PreparedWorldDefinition;
  readonly selectedStartingRegionId: RegionId;
  readonly eligibleStartingRegionIds: readonly RegionId[];
}

export interface MapStateRead {
  readonly mapDefinitionId: MapDefinitionId;
  readonly startingRegionId: RegionId;
  readonly unlockedRegionIds: readonly RegionId[];
}

export interface MapStateSnapshot {
  readonly mapDefinitionId: MapDefinitionId;
  readonly mapProfileId: "production-v1";
  readonly mapProfileVersion: 1;
  readonly startingRegionId: RegionId;
  readonly unlockedRegionIds: readonly RegionId[];
}

export interface WorldSystem {
  readonly definition: PreparedWorldDefinition;
  readonly spatial: WorldSpatialRead;
  readonly mapState: MapStateRead;
  captureSnapshot(): MapStateSnapshot;
}
