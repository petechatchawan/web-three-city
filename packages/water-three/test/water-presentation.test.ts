import type {
  WaterChunkMeshData,
  WaterSnapshot,
  WaterWallMeshData,
} from '@web-three-city/water-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WaterPresentation, type WaterPresentationSource } from '../src/index.js';

const bounds = { min: { x: 0, y: -1.5, z: 0 }, max: { x: 1, y: 0.51, z: 1 } } as const;

function terrain(revision: number): TerrainSnapshot {
  return {
    width: 128,
    height: 128,
    heightLevels: new Uint8Array(129 * 129).fill(0),
    seed: 7,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  };
}

function water(revision: number): WaterSnapshot {
  return {
    schemaVersion: 1,
    policyVersion: 'south-edge-sea-v1',
    width: 128,
    height: 128,
    seaLevel: 1,
    sourceTerrainRevision: revision,
    sourceTerrainSeed: 7,
    seaTriangleMask: new Uint8Array(128 * 128 * 2).fill(1),
    seaTriangleCount: 1,
    enclosedWetTriangleCount: 0,
    shorelineSegmentCount: 1,
  };
}

function chunkData(chunk = { x: 0, z: 0 }, revision = 1): WaterChunkMeshData {
  return {
    chunk,
    sourceTerrainRevision: revision,
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

function wallData(revision = 1): WaterWallMeshData {
  return {
    sourceTerrainRevision: revision,
    positions: new Float32Array([0, 0.51, 0, 1, 0.51, 0, 1, -1.5, 0, 0, -1.5, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    colors: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 0.5, 0, 0, 0.5]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
    segmentCount: 1,
    bounds,
  };
}

describe('WaterPresentation', () => {
  it('creates named objects with locked render order and shared materials', () => {
    const scene = new THREE.Scene();
    const source: WaterPresentationSource = {
      buildAll: () => ({ chunks: [chunkData()], wall: wallData() }),
    };
    const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
    presentation.load(terrain(1), water(1));
    const root = presentation.object3d;
    expect(root.name).toBe('water-presentation-root');
    expect(root.getObjectByName('water-surface-chunk:0:0')?.renderOrder).toBe(5);
    expect(root.getObjectByName('water-shoreline-chunk:0:0')?.renderOrder).toBe(6);
    expect(root.getObjectByName('water-wall')?.renderOrder).toBe(4);
    const surface = root.getObjectByName('water-surface-chunk:0:0') as THREE.Mesh;
    const shoreline = root.getObjectByName('water-shoreline-chunk:0:0') as THREE.Mesh;
    expect(surface.material).not.toBe(shoreline.material);
  });

  it('atomically replaces one root and disposes previous geometry', () => {
    const scene = new THREE.Scene();
    const source: WaterPresentationSource = {
      buildAll: (_terrain, snapshot) => ({
        chunks: [chunkData({ x: 0, z: 0 }, snapshot.sourceTerrainRevision)],
        wall: wallData(snapshot.sourceTerrainRevision),
      }),
    };
    const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
    presentation.load(terrain(1), water(1));
    const firstRoot = presentation.object3d;
    const firstSurface = firstRoot.getObjectByName('water-surface-chunk:0:0') as THREE.Mesh;
    const disposeSpy = vi.spyOn(firstSurface.geometry, 'dispose');
    presentation.load(terrain(2), water(2));
    expect(scene.children.filter((node) => node.name === 'water-presentation-root')).toHaveLength(
      1,
    );
    expect(presentation.object3d).not.toBe(firstRoot);
    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  it('preserves the accepted root and disposes staged geometry after adapter failure', () => {
    const scene = new THREE.Scene();
    let invalid = false;
    const source: WaterPresentationSource = {
      buildAll: () => ({
        chunks: invalid
          ? [chunkData(), { ...chunkData({ x: 1, z: 0 }), surfaceNormals: new Float32Array(3) }]
          : [chunkData()],
        wall: wallData(),
      }),
    };
    const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
    presentation.load(terrain(1), water(1));
    const accepted = presentation.object3d;
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    invalid = true;
    expect(() => presentation.load(terrain(1), water(1))).toThrowError(
      'water-three:invalid-surface-attributes',
    );
    expect(presentation.object3d).toBe(accepted);
    expect(scene.children.filter((node) => node.name === 'water-presentation-root')).toHaveLength(
      1,
    );
    expect(disposeSpy).toHaveBeenCalled();
    disposeSpy.mockRestore();
  });

  it('rejects stale snapshots and disposes idempotently', () => {
    const scene = new THREE.Scene();
    const source: WaterPresentationSource = {
      buildAll: () => ({ chunks: [chunkData()], wall: wallData() }),
    };
    const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
    expect(() => presentation.load(terrain(2), water(1))).toThrowError(
      expect.objectContaining({ code: 'water:terrain-revision-mismatch' }),
    );
    presentation.load(terrain(1), water(1));
    presentation.dispose();
    presentation.dispose();
    expect(scene.children).toHaveLength(0);
    expect(() => presentation.object3d).toThrowError(
      expect.objectContaining({ code: 'water:disposed' }),
    );
  });
});
