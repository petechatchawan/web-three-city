import type { WorldConfig } from './config.js';
import { WorldContractError } from './errors.js';

export interface CellCoord {
  readonly x: number;
  readonly z: number;
}

export interface GridVertexCoord {
  readonly x: number;
  readonly z: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function isIntegerInRange(value: number, minimum: number, maximumExclusive: number): boolean {
  return Number.isInteger(value) && value >= minimum && value < maximumExclusive;
}

export function assertCellCoord(coord: CellCoord, config: WorldConfig): void {
  if (
    !isIntegerInRange(coord.x, 0, config.mapWidth) ||
    !isIntegerInRange(coord.z, 0, config.mapHeight)
  ) {
    throw new WorldContractError('world:invalid-cell-coordinate', { coord });
  }
}

export function assertGridVertexCoord(coord: GridVertexCoord, config: WorldConfig): void {
  if (
    !isIntegerInRange(coord.x, 0, config.mapWidth + 1) ||
    !isIntegerInRange(coord.z, 0, config.mapHeight + 1)
  ) {
    throw new WorldContractError('world:invalid-vertex-coordinate', { coord });
  }
}

export function cellIndex(coord: CellCoord, config: WorldConfig): number {
  assertCellCoord(coord, config);
  return coord.z * config.mapWidth + coord.x;
}

export function vertexIndex(coord: GridVertexCoord, config: WorldConfig): number {
  assertGridVertexCoord(coord, config);
  return coord.z * (config.mapWidth + 1) + coord.x;
}

export function vertexToWorld(
  coord: GridVertexCoord,
  heightLevel: number,
  config: WorldConfig,
): WorldPoint {
  assertGridVertexCoord(coord, config);
  return {
    x: (coord.x - config.mapWidth / 2) * config.cellSize,
    y: heightLevel * config.heightStep,
    z: (coord.z - config.mapHeight / 2) * config.cellSize,
  };
}

export function worldToCell(point: WorldPoint, config: WorldConfig): CellCoord {
  const gridX = point.x / config.cellSize + config.mapWidth / 2;
  const gridZ = point.z / config.cellSize + config.mapHeight / 2;

  if (gridX < 0 || gridX >= config.mapWidth || gridZ < 0 || gridZ >= config.mapHeight) {
    throw new WorldContractError('world:outside-map', { point });
  }

  return { x: Math.floor(gridX), z: Math.floor(gridZ) };
}
