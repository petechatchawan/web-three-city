import type {
  WorldReadResult,
  WorldSpatialRead,
} from "../contracts/world-read";
import type {
  CellCoord,
  CellRect,
  CellWorldBounds,
  ChunkCoord,
  RegionId,
  VertexCoord,
  WorldXZ,
} from "../domain/coordinates";
import {
  cardinalNeighbors,
  cellBounds,
  cellToChunk,
  incidentCells,
  intersectingChunks,
  isValidCell,
  isValidCellRect,
  isValidVertex,
  isValidWorldPosition,
  ownerChunk,
  touchingChunks,
  worldPositionToCell,
} from "../domain/grid-topology";
import type { PreparedRegionIndex } from "../domain/region-geometry";

type GridSpatialRead = Pick<
  WorldSpatialRead,
  | "cellToChunk"
  | "ownerChunk"
  | "incidentCells"
  | "touchingChunks"
  | "cardinalNeighbors"
  | "intersectingChunks"
  | "worldPositionToCell"
  | "cellBounds"
>;

const OUT_OF_BOUNDS = {
  status: "rejected",
  code: "WORLD_COORD_OUT_OF_BOUNDS",
} as const;

function success<T>(value: T): WorldReadResult<T> {
  return { status: "success", value };
}

function readCell<T>(
  cell: CellCoord,
  project: (validCell: CellCoord) => T,
): WorldReadResult<T> {
  return isValidCell(cell) ? success(project(cell)) : OUT_OF_BOUNDS;
}

function readVertex<T>(
  vertex: VertexCoord,
  project: (validVertex: VertexCoord) => T,
): WorldReadResult<T> {
  return isValidVertex(vertex) ? success(project(vertex)) : OUT_OF_BOUNDS;
}

export function createGridSpatialRead(): GridSpatialRead {
  return {
    cellToChunk(cell) {
      return readCell(cell, cellToChunk);
    },
    ownerChunk(vertex) {
      return readVertex(vertex, ownerChunk);
    },
    incidentCells(vertex) {
      return readVertex(vertex, incidentCells);
    },
    touchingChunks(vertex) {
      return readVertex(vertex, touchingChunks);
    },
    cardinalNeighbors(cell) {
      return readCell(cell, cardinalNeighbors);
    },
    intersectingChunks(rect: CellRect): WorldReadResult<readonly ChunkCoord[]> {
      return isValidCellRect(rect)
        ? success(intersectingChunks(rect))
        : OUT_OF_BOUNDS;
    },
    worldPositionToCell(position: WorldXZ): WorldReadResult<CellCoord> {
      return isValidWorldPosition(position)
        ? success(worldPositionToCell(position))
        : OUT_OF_BOUNDS;
    },
    cellBounds(cell: CellCoord): WorldReadResult<CellWorldBounds> {
      return readCell(cell, cellBounds);
    },
  };
}

export function createWorldSpatialRead(
  regions: PreparedRegionIndex,
): WorldSpatialRead {
  const grid = createGridSpatialRead();

  return Object.freeze({
    ...grid,
    regionAtCell(cell: CellCoord): WorldReadResult<RegionId> {
      if (!isValidCell(cell)) {
        return OUT_OF_BOUNDS;
      }
      const regionId = regions.regionAt(cell);
      return regionId === undefined
        ? { status: "rejected", code: "WORLD_MAP_DEFINITION_INVALID" }
        : success(regionId);
    },
    adjacentRegions(regionId: RegionId): WorldReadResult<readonly RegionId[]> {
      const adjacent = regions.adjacentRegions(regionId);
      return adjacent === undefined
        ? { status: "rejected", code: "WORLD_REGION_UNKNOWN" }
        : success(adjacent);
    },
  });
}
