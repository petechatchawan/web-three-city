import type {
  CellCoord,
  CellRect,
  CellWorldBounds,
  ChunkCoord,
  VertexCoord,
  WorldXZ,
} from "./coordinates";

export const WORLD_WIDTH_CELLS = 512;
export const WORLD_HEIGHT_CELLS = 512;
export const CELL_SIZE_METERS = 8;
export const CHUNK_SIZE_CELLS = 32;
export const CHUNK_WIDTH = 16;
export const CHUNK_HEIGHT = 16;
export const VERTEX_WIDTH = WORLD_WIDTH_CELLS + 1;
export const VERTEX_HEIGHT = WORLD_HEIGHT_CELLS + 1;
export const WORLD_WIDTH_METERS = WORLD_WIDTH_CELLS * CELL_SIZE_METERS;
export const WORLD_HEIGHT_METERS = WORLD_HEIGHT_CELLS * CELL_SIZE_METERS;

export interface CellChunkLocation {
  readonly chunk: ChunkCoord;
  readonly local: CellCoord;
}

function isIntegerInRange(
  value: number,
  minInclusive: number,
  maxInclusive: number,
): boolean {
  return (
    Number.isInteger(value) && value >= minInclusive && value <= maxInclusive
  );
}

function compareChunk(left: ChunkCoord, right: ChunkCoord): number {
  return left.z - right.z || left.x - right.x;
}

export function isValidCell(cell: CellCoord): boolean {
  return (
    isIntegerInRange(cell.x, 0, WORLD_WIDTH_CELLS - 1) &&
    isIntegerInRange(cell.z, 0, WORLD_HEIGHT_CELLS - 1)
  );
}

export function isValidVertex(vertex: VertexCoord): boolean {
  return (
    isIntegerInRange(vertex.x, 0, WORLD_WIDTH_CELLS) &&
    isIntegerInRange(vertex.z, 0, WORLD_HEIGHT_CELLS)
  );
}

export function isValidCellRect(rect: CellRect): boolean {
  return (
    Number.isInteger(rect.xStartInclusive) &&
    Number.isInteger(rect.zStartInclusive) &&
    Number.isInteger(rect.xEndExclusive) &&
    Number.isInteger(rect.zEndExclusive) &&
    rect.xStartInclusive >= 0 &&
    rect.zStartInclusive >= 0 &&
    rect.xEndExclusive <= WORLD_WIDTH_CELLS &&
    rect.zEndExclusive <= WORLD_HEIGHT_CELLS &&
    rect.xStartInclusive < rect.xEndExclusive &&
    rect.zStartInclusive < rect.zEndExclusive
  );
}

export function isValidWorldPosition(position: WorldXZ): boolean {
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.z) &&
    position.x >= 0 &&
    position.z >= 0 &&
    position.x < WORLD_WIDTH_METERS &&
    position.z < WORLD_HEIGHT_METERS
  );
}

export function cellToChunk(cell: CellCoord): CellChunkLocation {
  const chunkX = Math.floor(cell.x / CHUNK_SIZE_CELLS);
  const chunkZ = Math.floor(cell.z / CHUNK_SIZE_CELLS);

  return {
    chunk: { x: chunkX, z: chunkZ },
    local: {
      x: cell.x - chunkX * CHUNK_SIZE_CELLS,
      z: cell.z - chunkZ * CHUNK_SIZE_CELLS,
    },
  };
}

function ownerAxis(vertexAxis: number): number {
  return vertexAxis === 0
    ? 0
    : Math.min(
        Math.floor((vertexAxis - 1) / CHUNK_SIZE_CELLS),
        CHUNK_WIDTH - 1,
      );
}

export function ownerChunk(vertex: VertexCoord): ChunkCoord {
  return {
    x: ownerAxis(vertex.x),
    z: ownerAxis(vertex.z),
  };
}

export function incidentCells(vertex: VertexCoord): readonly CellCoord[] {
  const cells: CellCoord[] = [];

  for (const z of [vertex.z - 1, vertex.z]) {
    for (const x of [vertex.x - 1, vertex.x]) {
      const cell = { x, z };
      if (isValidCell(cell)) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

export function touchingChunks(vertex: VertexCoord): readonly ChunkCoord[] {
  const chunksByKey = new Map<string, ChunkCoord>();

  for (const cell of incidentCells(vertex)) {
    const chunk = cellToChunk(cell).chunk;
    chunksByKey.set(`${chunk.z}:${chunk.x}`, chunk);
  }

  return [...chunksByKey.values()].sort(compareChunk);
}

export function cardinalNeighbors(cell: CellCoord): readonly CellCoord[] {
  const candidates: readonly CellCoord[] = [
    { x: cell.x, z: cell.z + 1 },
    { x: cell.x + 1, z: cell.z },
    { x: cell.x, z: cell.z - 1 },
    { x: cell.x - 1, z: cell.z },
  ];

  return candidates.filter(isValidCell);
}

export function intersectingChunks(rect: CellRect): readonly ChunkCoord[] {
  const minChunkX = Math.floor(rect.xStartInclusive / CHUNK_SIZE_CELLS);
  const minChunkZ = Math.floor(rect.zStartInclusive / CHUNK_SIZE_CELLS);
  const maxChunkX = Math.floor((rect.xEndExclusive - 1) / CHUNK_SIZE_CELLS);
  const maxChunkZ = Math.floor((rect.zEndExclusive - 1) / CHUNK_SIZE_CELLS);
  const chunks: ChunkCoord[] = [];

  for (let z = minChunkZ; z <= maxChunkZ; z += 1) {
    for (let x = minChunkX; x <= maxChunkX; x += 1) {
      chunks.push({ x, z });
    }
  }

  return chunks;
}

export function worldPositionToCell(position: WorldXZ): CellCoord {
  return {
    x: Math.floor(position.x / CELL_SIZE_METERS),
    z: Math.floor(position.z / CELL_SIZE_METERS),
  };
}

export function cellBounds(cell: CellCoord): CellWorldBounds {
  const xMinInclusive = cell.x * CELL_SIZE_METERS;
  const zMinInclusive = cell.z * CELL_SIZE_METERS;

  return {
    xMinInclusive,
    zMinInclusive,
    xMaxExclusive: xMinInclusive + CELL_SIZE_METERS,
    zMaxExclusive: zMinInclusive + CELL_SIZE_METERS,
  };
}
