import { createEmptyRoadSnapshot, type RoadPlacementEnvironment } from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  RoadChunkPresentation,
  createRoadMeshData,
  type RoadPresentationSource,
} from '../src/index.js';

const environment: RoadPlacementEnvironment = Object.freeze({
  terrainRevision: 1,
  waterSourceTerrainRevision: 1,
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
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

function triangle(offset = 0) {
  return createRoadMeshData({
    positions: new Float32Array([offset, 1, 0, offset + 1, 1, 0, offset, 1, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    colors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint32Array([0, 2, 1]),
  });
}

function sourceWithCalls(calls: string[]): RoadPresentationSource {
  return {
    buildChunk(_roads, _environment, chunk) {
      calls.push(`${chunk.x}:${chunk.z}`);
      return triangle(chunk.x + chunk.z * 10);
    },
  };
}

function committedPages(scene: THREE.Scene): readonly THREE.Object3D[] {
  const root = scene.getObjectByName('road-committed-root');
  expect(root).toBeInstanceOf(THREE.Group);
  return (root as THREE.Group).children;
}

describe('RoadChunkPresentation render pages', () => {
  it('groups neighboring logical chunks into a bounded set of render pages', () => {
    const scene = new THREE.Scene();
    const presentation = new RoadChunkPresentation(scene, sourceWithCalls([]), WORLD_CONFIG);
    presentation.loadAll(createEmptyRoadSnapshot(WORLD_CONFIG), environment);

    const pages = committedPages(scene);
    expect(pages).toHaveLength(16);
    expect(pages.every((page) => page.name.startsWith('road-page:'))).toBe(true);
    expect(presentation.getChunkObject({ x: 0, z: 0 })).toBe(
      presentation.getChunkObject({ x: 1, z: 1 }),
    );
    expect(presentation.getChunkObject({ x: 0, z: 0 })).not.toBe(
      presentation.getChunkObject({ x: 2, z: 0 }),
    );

    presentation.dispose();
  });

  it('combines constituent logical chunk geometry into one page mesh', () => {
    const scene = new THREE.Scene();
    const presentation = new RoadChunkPresentation(scene, sourceWithCalls([]), WORLD_CONFIG);
    presentation.loadAll(createEmptyRoadSnapshot(WORLD_CONFIG), environment);

    const page = presentation.getChunkObject({ x: 0, z: 0 });
    expect(page.children).toHaveLength(1);
    const mesh = page.children[0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect((mesh as THREE.Mesh).geometry.getAttribute('position').count).toBe(12);

    presentation.dispose();
  });

  it('rebuilds each affected page once while preserving unaffected page identity', () => {
    const scene = new THREE.Scene();
    const calls: string[] = [];
    const presentation = new RoadChunkPresentation(scene, sourceWithCalls(calls), WORLD_CONFIG);
    const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    presentation.loadAll(roads, environment);
    const firstPage = presentation.getChunkObject({ x: 0, z: 0 });
    const unaffectedPage = presentation.getChunkObject({ x: 4, z: 0 });
    calls.length = 0;

    presentation.rebuildDirty(roads, environment, [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 0 },
    ]);

    expect(calls).toEqual(['0:0', '1:0', '0:1', '1:1']);
    expect(presentation.getChunkObject({ x: 0, z: 0 })).not.toBe(firstPage);
    expect(presentation.getChunkObject({ x: 1, z: 1 })).toBe(
      presentation.getChunkObject({ x: 0, z: 0 }),
    );
    expect(presentation.getChunkObject({ x: 4, z: 0 })).toBe(unaffectedPage);

    presentation.dispose();
  });

  it('rebuilds only the owning pages for dirty chunks in different page groups', () => {
    const scene = new THREE.Scene();
    const calls: string[] = [];
    const presentation = new RoadChunkPresentation(scene, sourceWithCalls(calls), WORLD_CONFIG);
    const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    presentation.loadAll(roads, environment);
    const unchanged = presentation.getChunkObject({ x: 4, z: 4 });
    calls.length = 0;

    presentation.rebuildDirty(roads, environment, [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ]);

    expect(calls).toHaveLength(8);
    expect(presentation.getChunkObject({ x: 4, z: 4 })).toBe(unchanged);
    presentation.dispose();
  });
});
