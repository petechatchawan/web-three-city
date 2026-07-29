import type {
  RoadMutationPlan,
  RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  RoadPreviewPresentation,
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

function plan(valid: boolean): RoadMutationPlan {
  const cell = Object.freeze({ x: 1, z: 1 });
  return Object.freeze({
    operation: 'build',
    baseRoadRevision: 0,
    baseTerrainRevision: 1,
    baseWaterSourceTerrainRevision: 1,
    requestedCells: Object.freeze([cell]),
    addedCells: valid ? Object.freeze([cell]) : Object.freeze([]),
    removedCells: Object.freeze([]),
    topologyChangedCells: valid ? Object.freeze([cell]) : Object.freeze([]),
    proposedDefinitionCodes: new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight),
    dirtyChunks: valid ? Object.freeze([{ x: 0, z: 0 }]) : Object.freeze([]),
    valid,
    invalidReason: valid ? null : 'road:wet-cell',
  });
}

describe('RoadPreviewPresentation', () => {
  it('uses separate valid and invalid preview roots and clears without touching committed objects', () => {
    const scene = new THREE.Scene();
    const committed = new THREE.Group();
    committed.name = 'committed-sentinel';
    scene.add(committed);
    const source: RoadPresentationSource = { buildChunk: () => triangle() };
    const preview = new RoadPreviewPresentation(scene, source, WORLD_CONFIG);

    preview.show(plan(true), environment);
    expect(preview.root?.name).toBe('road-preview-root-valid');
    const validMesh = preview.root?.children[0] as THREE.Mesh;
    expect((validMesh.material as THREE.Material).name).toBe('road-material-preview-valid');

    preview.show(plan(false), environment);
    expect(preview.root?.name).toBe('road-preview-root-invalid');
    const invalidMesh = preview.root?.children[0] as THREE.Mesh;
    expect((invalidMesh.material as THREE.Material).name).toBe('road-material-preview-invalid');
    expect(scene.getObjectByName('committed-sentinel')).toBe(committed);

    preview.clear();
    expect(preview.root).toBeNull();
    expect(scene.getObjectByName('committed-sentinel')).toBe(committed);

    preview.dispose();
    expect(() => preview.show(plan(true), environment)).toThrow('road-preview:disposed');
  });
});
