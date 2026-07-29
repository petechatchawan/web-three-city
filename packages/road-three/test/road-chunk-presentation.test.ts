import {
  createEmptyRoadSnapshot,
  type RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  RoadChunkPresentation,
  createRoadMeshData,
  type RoadPresentationSource,
} from '../src/index.js';

const environment: RoadPlacementEnvironment = Object.freeze({
  terrainRevision: 1,
  waterSourceTerrainRevision: 1,
  surfaceAt(cell): TerrainCellSurfaceProfile {
    return Object.freeze({
      cell: Object.freeze({ ...cell }),
      corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
      shape: 'flat',
      minimumLevel: 2,
      maximumLevel: 2,
      slopeAxis: null,
    });
  },
  isDry: () => true,
});

function triangle() {
  return createRoadMeshData({
    positions: new Float32Array([0, 1, 0, 1, 1, 0, 0, 1, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    colors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint32Array([0, 2, 1]),
  });
}

describe('RoadChunkPresentation', () => {
  it('keeps the previous chunk on staging failure and disposes it only after replacement', () => {
    const scene = new THREE.Scene();
    let fail = false;
    const source: RoadPresentationSource = {
      buildChunk(_roads, _environment, chunk) {
        if (fail && chunk.x === 0 && chunk.z === 0) throw new Error('source-failed');
        return triangle();
      },
    };
    const presentation = new RoadChunkPresentation(scene, source, WORLD_CONFIG);
    const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    presentation.loadAll(roads, environment);
    const previous = presentation.getChunkObject({ x: 0, z: 0 });
    const previousMesh = previous.children[0] as THREE.Mesh;
    const dispose = vi.spyOn(previousMesh.geometry, 'dispose');

    fail = true;
    expect(() => presentation.rebuildDirty(roads, environment, [{ x: 0, z: 0 }])).toThrow(
      'source-failed',
    );
    expect(presentation.getChunkObject({ x: 0, z: 0 })).toBe(previous);
    expect(previous.parent).not.toBeNull();
    expect(dispose).not.toHaveBeenCalled();

    fail = false;
    presentation.rebuildDirty(roads, environment, [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ]);
    expect(presentation.getChunkObject({ x: 0, z: 0 })).not.toBe(previous);
    expect(previous.parent).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();

    presentation.dispose();
    expect(scene.getObjectByName('road-committed-root')).toBeUndefined();
  });
});
