import type { WaterChunkMeshData, WaterWallMeshData } from '@web-three-city/water-core';
import { describe, expect, it } from 'vitest';
import {
  createWaterShorelineGeometry,
  createWaterSurfaceGeometry,
  createWaterWallGeometry,
} from '../src/index.js';

const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } } as const;

function chunkData(): WaterChunkMeshData {
  return {
    chunk: { x: 0, z: 0 },
    sourceTerrainRevision: 1,
    surfacePositions: new Float32Array([0, 0.51, 0, 0, 0.51, 1, 1, 0.51, 0]),
    surfaceNormals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    surfaceColors: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    surfaceIndices: new Uint16Array([0, 1, 2]),
    shorelinePositions: new Float32Array([0, 0.513, 0, 0, 0.513, 1, 1, 0.513, 0]),
    shorelineColors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    shorelineIndices: new Uint16Array([0, 1, 2]),
    surfaceTriangleCount: 1,
    shorelineTriangleCount: 1,
    bounds,
  };
}

function wallData(): WaterWallMeshData {
  return {
    sourceTerrainRevision: 1,
    positions: new Float32Array([0, 0.51, 0, 1, 0.51, 0, 1, -1.5, 0, 0, -1.5, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    colors: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 0.5, 0, 0, 0.5]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
    segmentCount: 1,
    bounds,
  };
}

describe('Water geometry adapters', () => {
  it('maps surface canonical arrays without copying', () => {
    const data = chunkData();
    const geometry = createWaterSurfaceGeometry(data);
    expect(geometry.getAttribute('position').array).toBe(data.surfacePositions);
    expect(geometry.getAttribute('normal').array).toBe(data.surfaceNormals);
    expect(geometry.getAttribute('color').array).toBe(data.surfaceColors);
    expect(geometry.getIndex()?.array).toBe(data.surfaceIndices);
  });

  it('maps shoreline and wall canonical arrays', () => {
    const chunk = chunkData();
    const shoreline = createWaterShorelineGeometry(chunk);
    expect(shoreline.getAttribute('position').array).toBe(chunk.shorelinePositions);
    expect(shoreline.getAttribute('color').array).toBe(chunk.shorelineColors);
    const wall = wallData();
    const geometry = createWaterWallGeometry(wall);
    expect(geometry.getAttribute('normal').array).toBe(wall.normals);
    expect(geometry.getIndex()?.array).toBe(wall.indices);
  });

  it('rejects malformed attribute lengths', () => {
    const data = chunkData();
    expect(() =>
      createWaterSurfaceGeometry({ ...data, surfaceNormals: new Float32Array(3) }),
    ).toThrowError('water-three:invalid-surface-attributes');
  });
});
