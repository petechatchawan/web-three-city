import { createHash } from 'node:crypto';
import {
  BASIC_ROAD_DEFINITION,
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  type RoadCellView,
  type RoadConnectionMask,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile, TerrainShape } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildRoadCellMesh, mergeRoadCellMeshes, type RoadMeshData } from '../src/index.js';

function surface(
  cell: CellCoord,
  shape: TerrainShape,
  corners: Readonly<{ nw: number; ne: number; sw: number; se: number }>,
): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    corners: Object.freeze({ ...corners }),
    shape,
    minimumLevel: Math.min(corners.nw, corners.ne, corners.sw, corners.se),
    maximumLevel: Math.max(corners.nw, corners.ne, corners.sw, corners.se),
    slopeAxis:
      shape === 'ramp-north' || shape === 'ramp-south'
        ? 'north-south'
        : shape === 'ramp-east' || shape === 'ramp-west'
          ? 'east-west'
          : null,
  });
}

function view(
  cell: CellCoord,
  connections: RoadConnectionMask,
  shape: TerrainShape = 'flat',
): RoadCellView {
  const corners =
    shape === 'ramp-north'
      ? { nw: 2, ne: 2, sw: 1, se: 1 }
      : shape === 'ramp-south'
        ? { nw: 1, ne: 1, sw: 2, se: 2 }
        : shape === 'ramp-east'
          ? { nw: 1, ne: 2, sw: 1, se: 2 }
          : shape === 'ramp-west'
            ? { nw: 2, ne: 1, sw: 2, se: 1 }
            : { nw: 2, ne: 2, sw: 2, se: 2 };
  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    definition: BASIC_ROAD_DEFINITION,
    connections,
    surface: surface(cell, shape, corners),
  });
}

function geometryHash(mesh: RoadMeshData): string {
  const hash = createHash('sha256');
  for (const array of [mesh.positions, mesh.normals, mesh.colors, mesh.indices]) {
    hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex');
}

function cellWorldBounds(cell: CellCoord): Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}> {
  const minX = (cell.x - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;
  const minZ = (cell.z - WORLD_CONFIG.mapHeight / 2) * WORLD_CONFIG.cellSize;
  return Object.freeze({
    minX,
    maxX: minX + WORLD_CONFIG.cellSize,
    minZ,
    maxZ: minZ + WORLD_CONFIG.cellSize,
  });
}

function expectValidMesh(mesh: RoadMeshData, cell: CellCoord): void {
  expect(mesh.positions.length % 3).toBe(0);
  expect(mesh.normals).toHaveLength(mesh.positions.length);
  expect(mesh.colors).toHaveLength(mesh.positions.length);
  expect(mesh.indices.length % 3).toBe(0);
  expect(mesh.triangleCount).toBe(mesh.indices.length / 3);
  expect(mesh.estimatedGeometryBytes).toBe(
    mesh.positions.byteLength +
      mesh.normals.byteLength +
      mesh.colors.byteLength +
      mesh.indices.byteLength,
  );
  expect([...mesh.positions, ...mesh.normals, ...mesh.colors]).toSatisfy((values: number[]) =>
    values.every(Number.isFinite),
  );
  const vertexCount = mesh.positions.length / 3;
  expect([...mesh.indices].every((index) => index >= 0 && index < vertexCount)).toBe(true);
  const bounds = cellWorldBounds(cell);
  for (let index = 0; index < mesh.positions.length; index += 3) {
    expect(mesh.positions[index]).toBeGreaterThanOrEqual(bounds.minX);
    expect(mesh.positions[index]).toBeLessThanOrEqual(bounds.maxX);
    expect(mesh.positions[index + 2]).toBeGreaterThanOrEqual(bounds.minZ);
    expect(mesh.positions[index + 2]).toBeLessThanOrEqual(bounds.maxZ);
  }
}

function boundaryVertices(mesh: RoadMeshData, axis: 'x' | 'z', value: number): readonly string[] {
  const coordinateOffset = axis === 'x' ? 0 : 2;
  const vertices = new Set<string>();
  for (let index = 0; index < mesh.positions.length; index += 3) {
    if (Math.abs(mesh.positions[index + coordinateOffset]! - value) > 1e-6) continue;
    vertices.add(
      `${mesh.positions[index]!.toFixed(6)},${mesh.positions[index + 1]!.toFixed(6)},${mesh.positions[
        index + 2
      ]!.toFixed(6)}`,
    );
  }
  return Object.freeze([...vertices].sort());
}

function projectedArea(mesh: RoadMeshData): number {
  let area = 0;
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const first = mesh.indices[index]! * 3;
    const second = mesh.indices[index + 1]! * 3;
    const third = mesh.indices[index + 2]! * 3;
    const ax = mesh.positions[first]!;
    const az = mesh.positions[first + 2]!;
    const bx = mesh.positions[second]!;
    const bz = mesh.positions[second + 2]!;
    const cx = mesh.positions[third]!;
    const cz = mesh.positions[third + 2]!;
    area += Math.abs(ax * (bz - cz) + bx * (cz - az) + cx * (az - bz)) / 2;
  }
  return area;
}

function expectedRoadFootprintArea(connections: RoadConnectionMask): number {
  const width = BASIC_ROAD_DEFINITION.width;
  const armLength = (WORLD_CONFIG.cellSize - width) / 2;
  const connectionCount = [ROAD_NORTH, ROAD_EAST, ROAD_SOUTH, ROAD_WEST].filter(
    (direction) => (connections & direction) !== 0,
  ).length;
  return width * width + connectionCount * width * armLength;
}

const GOLDENS = [
  ['isolated', 0, 'flat', 2, 'b44a68f52ff50bd95e11a02d4d1658a6dc818edf38e43c4b647c3e64b94977b6'],
  [
    'end-north',
    ROAD_NORTH,
    'flat',
    2,
    '3646b167fd02e7576044714b83610dc6559e276a4cd315212f590b20923916a8',
  ],
  [
    'straight-ns',
    ROAD_NORTH | ROAD_SOUTH,
    'flat',
    2,
    'f6ce92090ac2fb74ecc6c7077cba00e84a9fe590dccf91bdc983d892544ea01a',
  ],
  [
    'corner-ne',
    ROAD_NORTH | ROAD_EAST,
    'flat',
    4,
    '2a407791cac8679f91c1972afbededdf67a2dc895e9ea956fba4dfb8621c2e6a',
  ],
  [
    't-nes',
    ROAD_NORTH | ROAD_EAST | ROAD_SOUTH,
    'flat',
    4,
    '35c5990a665a369ec312a63d7a654fea1c205afad02338d93d520d83b9fde67f',
  ],
  [
    'four-way',
    ROAD_NORTH | ROAD_EAST | ROAD_SOUTH | ROAD_WEST,
    'flat',
    6,
    '4677ddfc5607edb1419dd381764a5b771c7123d08aa946a344728c43baafdd6d',
  ],
  [
    'ramp-ns',
    ROAD_NORTH | ROAD_SOUTH,
    'ramp-north',
    2,
    '99e7d920374b604e41619f430a1959e3de46dfbfa397c838fe111e3e4b593bf7',
  ],
  [
    'ramp-ew',
    ROAD_EAST | ROAD_WEST,
    'ramp-east',
    2,
    'e7d2d59e15a23e35e4f5b32d798fc0ad9dbef38f4901c56a63bcaf9650bd3baa',
  ],
] as const;

describe('road geometry', () => {
  it.each(GOLDENS)(
    'builds stable, triangle-bounded %s geometry',
    (_name, mask, shape, expectedTriangles, expectedHash) => {
      const cell = { x: 4, z: 7 };
      const first = buildRoadCellMesh(view(cell, mask, shape), WORLD_CONFIG);
      const second = buildRoadCellMesh(view(cell, mask, shape), WORLD_CONFIG);

      expectValidMesh(first, cell);
      expect(first.triangleCount).toBe(expectedTriangles);
      expect(projectedArea(first)).toBeCloseTo(expectedRoadFootprintArea(mask), 5);
      expect(first.positions).toEqual(second.positions);
      expect(first.indices).toEqual(second.indices);
      expect(geometryHash(first)).toBe(expectedHash);
    },
  );

  it('aligns exact shared-edge ports for Flat neighbors', () => {
    const west = buildRoadCellMesh(view({ x: 4, z: 4 }, ROAD_EAST), WORLD_CONFIG);
    const east = buildRoadCellMesh(view({ x: 5, z: 4 }, ROAD_WEST), WORLD_CONFIG);
    const boundaryX = (5 - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;

    expect(boundaryVertices(west, 'x', boundaryX)).toEqual(boundaryVertices(east, 'x', boundaryX));
  });

  it('aligns exact shared-edge ports for Flat-to-Ramp transitions', () => {
    const flat = buildRoadCellMesh(view({ x: 4, z: 4 }, ROAD_SOUTH), WORLD_CONFIG);
    const ramp = buildRoadCellMesh(
      view({ x: 4, z: 5 }, ROAD_NORTH | ROAD_SOUTH, 'ramp-north'),
      WORLD_CONFIG,
    );
    const boundaryZ = (5 - WORLD_CONFIG.mapHeight / 2) * WORLD_CONFIG.cellSize;

    expect(boundaryVertices(flat, 'z', boundaryZ)).toEqual(boundaryVertices(ramp, 'z', boundaryZ));
  });

  it('merges meshes with deterministic index offsets', () => {
    const first = buildRoadCellMesh(view({ x: 1, z: 1 }, ROAD_EAST), WORLD_CONFIG);
    const second = buildRoadCellMesh(view({ x: 2, z: 1 }, ROAD_WEST), WORLD_CONFIG);
    const merged = mergeRoadCellMeshes([first, second]);

    expect(merged.triangleCount).toBe(first.triangleCount + second.triangleCount);
    expect(merged.positions.length).toBe(first.positions.length + second.positions.length);
    expect([...merged.indices].slice(first.indices.length)).toEqual(
      [...second.indices].map((index) => index + first.positions.length / 3),
    );
  });
});
