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
  for (let index = 0; index < mesh.positions.length; index += 3) {
    expect(mesh.positions[index]).toBeGreaterThanOrEqual(cell.x * WORLD_CONFIG.cellSize);
    expect(mesh.positions[index]).toBeLessThanOrEqual((cell.x + 1) * WORLD_CONFIG.cellSize);
    expect(mesh.positions[index + 2]).toBeGreaterThanOrEqual(cell.z * WORLD_CONFIG.cellSize);
    expect(mesh.positions[index + 2]).toBeLessThanOrEqual((cell.z + 1) * WORLD_CONFIG.cellSize);
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

const GOLDENS = [
  ['isolated', 0, 'flat', '__PENDING_ISOLATED__'],
  ['end-north', ROAD_NORTH, 'flat', '__PENDING_END_NORTH__'],
  ['straight-ns', ROAD_NORTH | ROAD_SOUTH, 'flat', '__PENDING_STRAIGHT_NS__'],
  ['corner-ne', ROAD_NORTH | ROAD_EAST, 'flat', '__PENDING_CORNER_NE__'],
  ['t-nes', ROAD_NORTH | ROAD_EAST | ROAD_SOUTH, 'flat', '__PENDING_T_NES__'],
  ['four-way', ROAD_NORTH | ROAD_EAST | ROAD_SOUTH | ROAD_WEST, 'flat', '__PENDING_FOUR_WAY__'],
  ['ramp-ns', ROAD_NORTH | ROAD_SOUTH, 'ramp-north', '__PENDING_RAMP_NS__'],
  ['ramp-ew', ROAD_EAST | ROAD_WEST, 'ramp-east', '__PENDING_RAMP_EW__'],
] as const;

describe('road geometry', () => {
  it.each(GOLDENS)('builds stable %s geometry', (_name, mask, shape, expectedHash) => {
    const cell = { x: 4, z: 7 };
    const first = buildRoadCellMesh(view(cell, mask, shape), WORLD_CONFIG);
    const second = buildRoadCellMesh(view(cell, mask, shape), WORLD_CONFIG);

    expectValidMesh(first, cell);
    expect(first.positions).toEqual(second.positions);
    expect(first.indices).toEqual(second.indices);
    expect(geometryHash(first)).toBe(expectedHash);
  });

  it('aligns exact shared-edge ports for Flat neighbors', () => {
    const west = buildRoadCellMesh(view({ x: 4, z: 4 }, ROAD_EAST), WORLD_CONFIG);
    const east = buildRoadCellMesh(view({ x: 5, z: 4 }, ROAD_WEST), WORLD_CONFIG);

    expect(boundaryVertices(west, 'x', 5)).toEqual(boundaryVertices(east, 'x', 5));
  });

  it('aligns exact shared-edge ports for Flat-to-Ramp transitions', () => {
    const flat = buildRoadCellMesh(view({ x: 4, z: 4 }, ROAD_SOUTH), WORLD_CONFIG);
    const ramp = buildRoadCellMesh(
      view({ x: 4, z: 5 }, ROAD_NORTH | ROAD_SOUTH, 'ramp-north'),
      WORLD_CONFIG,
    );

    expect(boundaryVertices(flat, 'z', 5)).toEqual(boundaryVertices(ramp, 'z', 5));
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
