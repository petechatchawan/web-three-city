import type {
  ChunkCoord,
  OuterSkirtMeshData,
  TerrainChunkMeshData,
  TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TerrainPresentation } from '../src/terrain-presentation.js';
import type { TerrainPresentationSource } from '../src/terrain-presentation.js';

function snapshot(revision: number): TerrainSnapshot {
  return {
    width: 128,
    height: 128,
    heightLevels: new Uint8Array(129 * 129).fill(2),
    seed: 1,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  };
}

function chunkData(chunk: ChunkCoord, y = 0): TerrainChunkMeshData {
  return {
    chunk,
    positions: new Float32Array([0, y, 0, 1, y, 0, 0, y, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    colors: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 2, 1]),
    bounds: {
      min: { x: 0, y, z: 0 },
      max: { x: 1, y, z: 1 },
    },
  };
}

function skirtData(): OuterSkirtMeshData {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, -1.5, 0, 0, -1.5, 0]),
    normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
    colors: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]),
    indices: new Uint16Array([0, 2, 3, 0, 1, 2]),
    segmentCount: 1,
    bounds: {
      min: { x: 0, y: -1.5, z: 0 },
      max: { x: 1, y: 0, z: 0 },
    },
  };
}

describe('TerrainPresentation', () => {
  it('publishes a staged load atomically and preserves the old root on failure', () => {
    const scene = new THREE.Scene();
    let fail = false;
    const source: TerrainPresentationSource = {
      buildAll: () => {
        if (fail) throw new Error('mesh failed');
        return { chunks: [chunkData({ x: 0, z: 0 })], skirt: skirtData() };
      },
      buildChunks: (_snapshot, chunks) => chunks.map((chunk) => chunkData(chunk, 1)),
    };
    const presentation = new TerrainPresentation(scene, source, WORLD_CONFIG);

    presentation.load(snapshot(0));
    const acceptedRoot = scene.children[0];
    fail = true;

    expect(() => presentation.load(snapshot(1))).toThrowError('mesh failed');
    expect(scene.children).toEqual([acceptedRoot]);
  });

  it('replaces only requested chunk geometry and disposes owned resources idempotently', () => {
    const scene = new THREE.Scene();
    const source: TerrainPresentationSource = {
      buildAll: () => ({
        chunks: [chunkData({ x: 0, z: 0 }), chunkData({ x: 1, z: 0 })],
        skirt: skirtData(),
      }),
      buildChunks: (_snapshot, chunks) => chunks.map((chunk) => chunkData(chunk, 1)),
    };
    const presentation = new TerrainPresentation(scene, source, WORLD_CONFIG);
    presentation.load(snapshot(0));
    const first = presentation.getChunkMesh({ x: 0, z: 0 });
    const second = presentation.getChunkMesh({ x: 1, z: 0 });
    const dispose = vi.spyOn(first.geometry, 'dispose');

    presentation.rebuild(snapshot(1), [{ x: 0, z: 0 }]);

    expect(presentation.getChunkMesh({ x: 0, z: 0 })).not.toBe(first);
    expect(presentation.getChunkMesh({ x: 1, z: 0 })).toBe(second);
    expect(dispose).toHaveBeenCalledOnce();

    presentation.dispose();
    presentation.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
