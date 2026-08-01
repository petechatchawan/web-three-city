import {
  BASIC_ROAD_DEFINITION,
  type RoadCellView,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildRoadCellMesh } from '../src/index.js';

function flatRoadCell(x: number, z: number): RoadCellView {
  const corners = Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 });
  const surface: TerrainCellSurfaceProfile = Object.freeze({
    cell: Object.freeze({ x, z }),
    corners,
    shape: 'flat',
    minimumLevel: 2,
    maximumLevel: 2,
    slopeAxis: null,
  });

  return Object.freeze({
    cell: Object.freeze({ x, z }),
    definition: BASIC_ROAD_DEFINITION,
    connections: 0,
    surface,
  });
}

function axisValues(positions: Float32Array, offset: 0 | 2): readonly number[] {
  const values: number[] = [];
  for (let index = offset; index < positions.length; index += 3) {
    values.push(positions[index]!);
  }
  return Object.freeze(values);
}

describe('Road world origin', () => {
  it('places the center Terrain cell around the centered world origin', () => {
    const centerCell = {
      x: WORLD_CONFIG.mapWidth / 2,
      z: WORLD_CONFIG.mapHeight / 2,
    };
    const mesh = buildRoadCellMesh(
      flatRoadCell(centerCell.x, centerCell.z),
      WORLD_CONFIG,
    );
    const xs = axisValues(mesh.positions, 0);
    const zs = axisValues(mesh.positions, 2);

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(WORLD_CONFIG.cellSize);
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...zs)).toBeLessThanOrEqual(WORLD_CONFIG.cellSize);
  });
});
