import { WORLD_CONFIG, vertexIndex } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  createTerrainMap,
  terrainCellSurfaceProfile,
  type TerrainSnapshot,
} from '../src/index.js';

const CELL = Object.freeze({ x: 4, z: 7 });

function terrainWithCellCorners(corners: {
  readonly nw: number;
  readonly ne: number;
  readonly sw: number;
  readonly se: number;
}): TerrainSnapshot {
  const heightLevels = new Uint8Array(
    (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1),
  );
  heightLevels.fill(1);
  heightLevels[vertexIndex({ x: CELL.x, z: CELL.z }, WORLD_CONFIG)] = corners.nw;
  heightLevels[vertexIndex({ x: CELL.x + 1, z: CELL.z }, WORLD_CONFIG)] =
    corners.ne;
  heightLevels[vertexIndex({ x: CELL.x, z: CELL.z + 1 }, WORLD_CONFIG)] =
    corners.sw;
  heightLevels[
    vertexIndex({ x: CELL.x + 1, z: CELL.z + 1 }, WORLD_CONFIG)
  ] = corners.se;

  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels,
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 3,
  });
}

describe('terrain cell surface profile', () => {
  it('reports a flat cell with copied immutable data', () => {
    const terrain = terrainWithCellCorners({ nw: 2, ne: 2, sw: 2, se: 2 });
    const profile = terrainCellSurfaceProfile(terrain, CELL, WORLD_CONFIG);

    expect(profile).toEqual({
      cell: CELL,
      corners: { nw: 2, ne: 2, sw: 2, se: 2 },
      shape: 'flat',
      minimumLevel: 2,
      maximumLevel: 2,
      slopeAxis: null,
    });
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.cell)).toBe(true);
    expect(Object.isFrozen(profile.corners)).toBe(true);
    expect(profile.cell).not.toBe(CELL);
  });

  it('reports a north-south axis for a north ramp', () => {
    const terrain = terrainWithCellCorners({ nw: 2, ne: 2, sw: 1, se: 1 });

    expect(
      terrainCellSurfaceProfile(terrain, CELL, WORLD_CONFIG),
    ).toMatchObject({
      shape: 'ramp-north',
      minimumLevel: 1,
      maximumLevel: 2,
      slopeAxis: 'north-south',
    });
  });

  it('reports an east-west axis for an east ramp', () => {
    const terrain = terrainWithCellCorners({ nw: 1, ne: 2, sw: 1, se: 2 });

    expect(
      terrainCellSurfaceProfile(terrain, CELL, WORLD_CONFIG),
    ).toMatchObject({
      shape: 'ramp-east',
      minimumLevel: 1,
      maximumLevel: 2,
      slopeAxis: 'east-west',
    });
  });

  it.each([
    { x: -1, z: 0 },
    { x: 0, z: -1 },
    { x: WORLD_CONFIG.mapWidth, z: 0 },
    { x: 0, z: WORLD_CONFIG.mapHeight },
    { x: 0.5, z: 0 },
  ])('rejects an invalid cell coordinate %o', (cell) => {
    const terrain = terrainWithCellCorners({ nw: 1, ne: 1, sw: 1, se: 1 });

    expect(() =>
      terrainCellSurfaceProfile(terrain, cell, WORLD_CONFIG),
    ).toThrow('terrain-cell-surface:invalid-cell');
  });
});
