import { type CellCoord, type WorldConfig, vertexIndex } from '@web-three-city/world-core';
import { classifyTerrainShape, type TerrainShape } from './shape-classifier.js';
import type { TerrainSnapshot } from './terrain-map.js';
import type { TerrainCorners } from './topology.js';

export type TerrainSlopeAxis = 'north-south' | 'east-west' | null;

export interface TerrainCellSurfaceProfile {
  readonly cell: CellCoord;
  readonly corners: TerrainCorners;
  readonly shape: TerrainShape;
  readonly minimumLevel: number;
  readonly maximumLevel: number;
  readonly slopeAxis: TerrainSlopeAxis;
}

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < config.mapWidth &&
    cell.z < config.mapHeight
  );
}

function levelAt(terrain: TerrainSnapshot, x: number, z: number, config: WorldConfig): number {
  return terrain.heightLevels[vertexIndex({ x, z }, config)]!;
}

function slopeAxisFor(shape: TerrainShape): TerrainSlopeAxis {
  switch (shape) {
    case 'ramp-north':
    case 'ramp-south':
      return 'north-south';
    case 'ramp-east':
    case 'ramp-west':
      return 'east-west';
    default:
      return null;
  }
}

export function terrainCellSurfaceProfile(
  terrain: TerrainSnapshot,
  cell: CellCoord,
  config: WorldConfig,
): TerrainCellSurfaceProfile {
  if (!validCell(cell, config)) {
    throw new RangeError('terrain-cell-surface:invalid-cell');
  }

  const corners = Object.freeze({
    nw: levelAt(terrain, cell.x, cell.z, config),
    ne: levelAt(terrain, cell.x + 1, cell.z, config),
    sw: levelAt(terrain, cell.x, cell.z + 1, config),
    se: levelAt(terrain, cell.x + 1, cell.z + 1, config),
  });
  const shape = classifyTerrainShape(corners);

  return Object.freeze({
    cell: Object.freeze({ x: cell.x, z: cell.z }),
    corners,
    shape,
    minimumLevel: Math.min(corners.nw, corners.ne, corners.sw, corners.se),
    maximumLevel: Math.max(corners.nw, corners.ne, corners.sw, corners.se),
    slopeAxis: slopeAxisFor(shape),
  });
}
