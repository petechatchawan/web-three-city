import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  RESIDENTIAL_ZONE_CODE,
  createEmptyZoneSnapshot,
  createZoneSnapshot,
  type ZoneMutationPlan,
} from '@web-three-city/zone-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ZonePreviewPresentation } from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function flatSurface(cell: CellCoord): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: cell.x, z: cell.z }),
    corners: Object.freeze({ nw: 1, ne: 1, sw: 1, se: 1 }),
    shape: 'flat',
    minimumLevel: 1,
    maximumLevel: 1,
    slopeAxis: null,
  });
}

function plan(input: Partial<ZoneMutationPlan> = {}): ZoneMutationPlan {
  const proposed = new Uint8Array(CELL_COUNT);
  proposed[10 * WORLD_CONFIG.mapWidth + 10] = RESIDENTIAL_ZONE_CODE;
  return Object.freeze({
    operation: 'paint',
    definitionId: 'residential',
    baseZoneRevision: 0,
    baseTerrainRevision: 1,
    baseWaterSourceTerrainRevision: 1,
    baseRoadRevision: 1,
    baseOccupancyRevision: 1,
    requestedCells: Object.freeze([
      Object.freeze({ x: 10, z: 10 }),
      Object.freeze({ x: 11, z: 10 }),
    ]),
    changedCells: Object.freeze([Object.freeze({ x: 10, z: 10 })]),
    unchangedCells: Object.freeze([]),
    invalidCells: Object.freeze([]),
    get proposedDefinitionCodes() {
      return proposed.slice();
    },
    dirtyChunks: Object.freeze([{ x: 0, z: 0 }]),
    valid: true,
    invalidReason: null,
    ...input,
  });
}

describe('ZonePreviewPresentation', () => {
  it('renders only effective changed cells for valid Paint Preview', () => {
    const scene = new THREE.Scene();
    const presentation = new ZonePreviewPresentation(scene, flatSurface, WORLD_CONFIG);
    presentation.show(createEmptyZoneSnapshot(WORLD_CONFIG), plan());

    expect(presentation.root?.name).toBe('zone-preview-root-valid');
    const mesh = scene.getObjectByName('zone-preview-paint-valid-surface') as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry.getAttribute('position').count).toBe(4);
  });

  it('renders requested invalid cells and markers without committed mutation', () => {
    const scene = new THREE.Scene();
    const base = createEmptyZoneSnapshot(WORLD_CONFIG);
    const presentation = new ZonePreviewPresentation(scene, flatSurface, WORLD_CONFIG);
    presentation.show(
      base,
      plan({
        valid: false,
        invalidReason: 'zone:wet-cell',
        changedCells: Object.freeze([]),
        invalidCells: Object.freeze([
          Object.freeze({
            cell: Object.freeze({ x: 11, z: 10 }),
            reason: 'zone:wet-cell' as const,
          }),
        ]),
      }),
    );

    const mesh = scene.getObjectByName('zone-preview-invalid-surface') as THREE.Mesh;
    const marker = scene.getObjectByName('zone-preview-invalid-marker') as THREE.LineSegments;
    expect(mesh.geometry.getAttribute('position').count).toBe(8);
    expect(marker.geometry.getAttribute('position').count).toBe(4);
    expect(base.definitionCodes.every((code) => code === 0)).toBe(true);
  });

  it('uses the base snapshot for Remove Preview and clears atomically', () => {
    const codes = new Uint8Array(CELL_COUNT);
    codes[10 * WORLD_CONFIG.mapWidth + 10] = RESIDENTIAL_ZONE_CODE;
    const base = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 3,
        definitionCodes: codes,
      },
      WORLD_CONFIG,
    );
    const scene = new THREE.Scene();
    const presentation = new ZonePreviewPresentation(scene, flatSurface, WORLD_CONFIG);
    presentation.show(
      base,
      plan({
        operation: 'remove',
        definitionId: null,
        baseZoneRevision: 3,
        requestedCells: Object.freeze([Object.freeze({ x: 10, z: 10 })]),
      }),
    );

    expect(scene.getObjectByName('zone-preview-remove-valid-surface')).toBeInstanceOf(THREE.Mesh);
    presentation.clear();
    expect(presentation.root).toBeNull();
    expect(scene.getObjectByName('zone-preview-root-valid')).toBeUndefined();
  });
});
