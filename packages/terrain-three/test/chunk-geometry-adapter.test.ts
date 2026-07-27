import type { TerrainChunkMeshData } from '@web-three-city/terrain-core';
import { describe, expect, it } from 'vitest';
import { createChunkGeometry } from '../src/chunk-geometry-adapter.js';

function chunkData(): TerrainChunkMeshData {
  return {
    chunk: { x: 0, z: 0 },
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    colors: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 2, 1]),
    bounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 0, z: 1 },
    },
  };
}

describe('Three.js chunk geometry adapter', () => {
  it('uses the supplied canonical typed arrays without recomputing normals', () => {
    const data = chunkData();
    const geometry = createChunkGeometry(data);

    expect(geometry.getAttribute('position').array).toBe(data.positions);
    expect(geometry.getAttribute('normal').array).toBe(data.normals);
    expect(geometry.getAttribute('color').array).toBe(data.colors);
    expect(geometry.getIndex()?.array).toBe(data.indices);
    expect(geometry.boundingBox).not.toBeNull();
    expect(geometry.boundingSphere).not.toBeNull();
  });
});
