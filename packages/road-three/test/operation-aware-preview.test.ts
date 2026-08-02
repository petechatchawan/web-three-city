import {
  BASIC_ROAD_CODE,
  createRoadSnapshot,
  planRoadMutation,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RoadPreviewPresentation, createCoreRoadPresentationSource } from '../src/index.js';

function environment(dry: boolean): RoadPlacementEnvironment {
  return Object.freeze({
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
    isDry: () => dry,
  });
}

function snapshot(cells: readonly CellCoord[]): RoadSnapshot {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
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

function firstMesh(root: THREE.Group | null): THREE.Mesh {
  let result: THREE.Mesh | null = null;
  root?.traverse((object) => {
    if (result === null && object instanceof THREE.Mesh) result = object;
  });
  if (result === null) throw new Error('operation-aware-preview:missing-mesh');
  return result;
}

describe('operation-aware Road Preview', () => {
  it('uses operation and validity specific materials and a Bulldoze marker', () => {
    const scene = new THREE.Scene();
    const preview = new RoadPreviewPresentation(
      scene,
      createCoreRoadPresentationSource(WORLD_CONFIG),
      WORLD_CONFIG,
    );
    const cell = { x: 64, z: 64 };
    const empty = snapshot([]);
    const occupied = snapshot([cell]);
    const dry = environment(true);
    const wet = environment(false);

    const buildValid = planRoadMutation(
      empty,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      dry,
      WORLD_CONFIG,
    );
    preview.show(empty, buildValid, dry);
    expect((firstMesh(preview.root).material as THREE.Material).name).toBe(
      'road-material-preview-build-valid',
    );

    const buildInvalid = planRoadMutation(
      empty,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      wet,
      WORLD_CONFIG,
    );
    preview.show(empty, buildInvalid, wet);
    expect((firstMesh(preview.root).material as THREE.Material).name).toBe(
      'road-material-preview-build-invalid',
    );

    const bulldozeValid = planRoadMutation(
      occupied,
      { operation: 'bulldoze', definitionId: 'basic-road', cells: [cell] },
      dry,
      WORLD_CONFIG,
    );
    preview.show(occupied, bulldozeValid, dry);
    expect((firstMesh(preview.root).material as THREE.Material).name).toBe(
      'road-material-preview-bulldoze-valid',
    );
    const marker = preview.root?.getObjectByName('road-preview-bulldoze-marker');
    expect(marker).toBeInstanceOf(THREE.LineSegments);
    expect(((marker as THREE.LineSegments).material as THREE.Material).name).toBe(
      'road-material-preview-bulldoze-marker',
    );

    const bulldozeInvalid = planRoadMutation(
      empty,
      { operation: 'bulldoze', definitionId: 'basic-road', cells: [cell] },
      dry,
      WORLD_CONFIG,
    );
    preview.show(empty, bulldozeInvalid, dry);
    expect((firstMesh(preview.root).material as THREE.Material).name).toBe(
      'road-material-preview-bulldoze-invalid',
    );
    preview.dispose();
  });
});
