import { WORLD_CONFIG, vertexIndex } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  createTerrainMap,
  terrainCellSurfaceProfile,
  type TerrainCorners,
  type TerrainSnapshot,
} from '../src/index.js';

const CELL = Object.freeze({ x: 4, z: 7 });
const LATTICE_SIZE =
  (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function cellVertexIndex(dx: number, dz: number): number {
  return vertexIndex({ x: CELL.x + dx, z: CELL.z + dz }, WORLD_CONFIG);
}

function terrainWithCellCorners(corners: TerrainCorners): TerrainSnapshot {
  const levels = new Uint8Array(LATTICE_SIZE).fill(1);
  levels[cellVertexIndex(0, 0)] = corners.nw;
  levels[cellVertexIndex(1, 0)] = corners.ne;
  levels[cellVertexIndex(0, 1)] = corners.sw;
  levels[cellVertexIndex(1, 1)] = corners.se;

  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: levels,
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 3,
  });
}

describe('terrain cell surface profile', () => {
  it('reports a flat cell with copied immutable data', () => {
    const terrain = terrainWithCellCorners({
      nw: 2,
      ne: 2,
      sw: 2,
      se: 2,
    });
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
    const terrain = terrainWithCellCorners({
      nw: 2,
      ne: 2,
      sw: 1,
      se: 1,
    });
    const profile = terrainCellSurfaceProfile(terrain, CELL, WORLD_CONFIG);

    expect(profile).toMatchObject({
      shape: 'ramp-north',
      minimumLevel: 1,
      maximumLevel: 2,
      slopeAxis: 'north-south',
    });
  });

  it('reports an east-west axis for an east ramp', () => {
    const terrain = terrainWithCellCorners({
      nw: 1,
      ne: 2,
      sw: 1,
      se: 2,
    });
    const profile = terrainCellSurfaceProfile(terrain, CELL, WORLD_CONFIG);

    expect(profile).toMatchObject({
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
    const terrain = terrainWithCellCorners({
      nw: 1,
      ne: 1,
      sw: 1,
      se: 1,
    });
    const read = () => terrainCellSurfaceProfile(terrain, cell, WORLD_CONFIG);

    expect(read).toThrow('terrain-cell-surface:invalid-cell');
  });
});
