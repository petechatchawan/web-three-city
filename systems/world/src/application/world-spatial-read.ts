import type {
  WorldReadResult,
  WorldSpatialRead,
} from "../contracts/world-read";
import type {
  CellCoord,
  CellRect,
  CellWorldBounds,
  ChunkCoord,
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
