import {
  BASIC_ROAD_CODE,
  createRoadSnapshot,
  planRoadMutation,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  RoadPreviewPresentation,
  createCoreRoadPresentationSource,
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

function triangle() {
  return createRoadMeshData({
    positions: new Float32Array([0, 1, 0, 1, 1, 0, 0, 1, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    colors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint32Array([0, 2, 1]),
  });
}

function snapshotWithRoads(cells: readonly CellCoord[]): RoadSnapshot {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  for (const cell of cells) {
    codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  }
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function emptySnapshot(): RoadSnapshot {
  return snapshotWithRoads([]);
}

function plan(valid: boolean): RoadMutationPlan {
  const cell = Object.freeze({ x: 1, z: 1 });
  const proposedDefinitionCodes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  if (valid) {
    proposedDefinitionCodes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  }
  return Object.freeze({
    operation: 'build',
    baseRoadRevision: 0,
    baseTerrainRevision: 1,
    baseWaterSourceTerrainRevision: 1,
    requestedCells: Object.freeze([cell]),
    addedCells: valid ? Object.freeze([cell]) : Object.freeze([]),
    removedCells: Object.freeze([]),
    topologyChangedCells: valid ? Object.freeze([cell]) : Object.freeze([]),
    proposedDefinitionCodes,
    dirtyChunks: valid ? Object.freeze([{ x: 0, z: 0 }]) : Object.freeze([]),
    valid,
    invalidReason: valid ? null : 'road:wet-cell',
  });
}

function meshBounds(preview: RoadPreviewPresentation): THREE.Box3 {
  const mesh = preview.root?.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox;
  expect(bounds).not.toBeNull();
  return bounds!;
}

describe('RoadPreviewPresentation', () => {
  it('uses separate valid and invalid roots with a non-color invalid marker', () => {
    const scene = new THREE.Scene();
    const committed = new THREE.Group();
    committed.name = 'committed-sentinel';
    scene.add(committed);
    const source: RoadPresentationSource = { buildChunk: () => triangle() };
    const preview = new RoadPreviewPresentation(scene, source, WORLD_CONFIG);
    const base = emptySnapshot();

    preview.show(base, plan(true), environment);
    expect(preview.root?.name).toBe('road-preview-root-valid');
    const validMesh = preview.root?.children[0] as THREE.Mesh;
    expect((validMesh.material as THREE.Material).name).toBe('road-material-preview-build-valid');

    preview.show(base, plan(false), environment);
    expect(preview.root?.name).toBe('road-preview-root-invalid');
    const invalidMesh = preview.root?.getObjectByName('road-preview-invalid-surface') as THREE.Mesh;
    const invalidMarker = preview.root?.getObjectByName(
      'road-preview-invalid-marker',
    ) as THREE.LineSegments;
    expect((invalidMesh.material as THREE.Material).name).toBe(
      'road-material-preview-build-invalid',
    );
    expect(invalidMarker).toBeInstanceOf(THREE.LineSegments);
    expect((invalidMarker.material as THREE.Material).name).toBe(
      'road-material-preview-build-invalid-marker',
    );
    expect((invalidMarker.material as THREE.LineBasicMaterial).depthTest).toBe(true);
    expect(scene.getObjectByName('committed-sentinel')).toBe(committed);

    preview.clear();
    expect(preview.root).toBeNull();
    expect(scene.getObjectByName('committed-sentinel')).toBe(committed);

    preview.dispose();
    expect(() => preview.show(base, plan(true), environment)).toThrow('road-preview:disposed');
  });

  it('renders valid Build Preview only for cells added by the active stroke', () => {
    const scene = new THREE.Scene();
    const source = createCoreRoadPresentationSource(WORLD_CONFIG);
    const preview = new RoadPreviewPresentation(scene, source, WORLD_CONFIG);
    const base = snapshotWithRoads([{ x: 10, z: 10 }]);
    const buildPlan = planRoadMutation(
      base,
      {
        operation: 'build',
        definitionId: 'basic-road',
        cells: [{ x: 11, z: 10 }],
      },
      environment,
      WORLD_CONFIG,
    );

    expect(buildPlan.valid).toBe(true);
    preview.show(base, buildPlan, environment);

    const bounds = meshBounds(preview);
    const addedCellMinimumX = (11 - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;
    expect(bounds.min.x).toBeGreaterThanOrEqual(addedCellMinimumX - 0.0001);
    preview.dispose();
  });

  it('renders valid Bulldoze Preview only for cells removed by the active stroke', () => {
    const scene = new THREE.Scene();
    const source = createCoreRoadPresentationSource(WORLD_CONFIG);
    const preview = new RoadPreviewPresentation(scene, source, WORLD_CONFIG);
    const base = snapshotWithRoads([
      { x: 10, z: 10 },
      { x: 11, z: 10 },
      { x: 12, z: 10 },
    ]);
    const bulldozePlan = planRoadMutation(
      base,
      {
        operation: 'bulldoze',
        definitionId: 'basic-road',
        cells: [{ x: 11, z: 10 }],
      },
      environment,
      WORLD_CONFIG,
    );

    expect(bulldozePlan.valid).toBe(true);
    preview.show(base, bulldozePlan, environment);

    const bounds = meshBounds(preview);
    const removedCellMinimumX = (11 - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;
    const removedCellMaximumX = removedCellMinimumX + WORLD_CONFIG.cellSize;
    expect(bounds.min.x).toBeGreaterThanOrEqual(removedCellMinimumX - 0.0001);
    expect(bounds.max.x).toBeLessThanOrEqual(removedCellMaximumX + 0.0001);
    preview.dispose();
  });

  it('atomically replaces a longer Preview with a backtracked shorter Preview', () => {
    const scene = new THREE.Scene();
    const source = createCoreRoadPresentationSource(WORLD_CONFIG);
    const preview = new RoadPreviewPresentation(scene, source, WORLD_CONFIG);
    const base = snapshotWithRoads([{ x: 10, z: 10 }]);
    const longPlan = planRoadMutation(
      base,
      {
        operation: 'build',
        definitionId: 'basic-road',
        cells: [
          { x: 11, z: 10 },
          { x: 12, z: 10 },
        ],
      },
      environment,
      WORLD_CONFIG,
    );
    const shortPlan = planRoadMutation(
      base,
      {
        operation: 'build',
        definitionId: 'basic-road',
        cells: [{ x: 11, z: 10 }],
      },
      environment,
      WORLD_CONFIG,
    );

    preview.show(base, longPlan, environment);
    const previousRoot = preview.root!;
    const previousGeometry = (previousRoot.children[0] as THREE.Mesh).geometry;
    const disposed = vi.fn();
    previousGeometry.addEventListener('dispose', disposed);

    preview.show(base, shortPlan, environment);

    expect(scene.children).not.toContain(previousRoot);
    expect(disposed).toHaveBeenCalledTimes(1);
    const bounds = meshBounds(preview);
    const shortCellMaximumX = (12 - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;
    expect(bounds.max.x).toBeLessThanOrEqual(shortCellMaximumX + 0.0001);
    preview.dispose();
  });
});
