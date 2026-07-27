import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import { selectTerrainDiagonal } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, vertexToWorld, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SelectedCellPresentation, buildSelectedCellOverlayData } from '../src/index.js';

function snapshot(revision = 0): TerrainSnapshot {
  const width = WORLD_CONFIG.mapWidth + 1;
  const levels = new Uint8Array(width * (WORLD_CONFIG.mapHeight + 1)).fill(2);
  levels[7 * width + 4] = 2;
  levels[7 * width + 5] = 3;
  levels[8 * width + 4] = 3;
  levels[8 * width + 5] = 3;
  return {
    width: WORLD_CONFIG.mapWidth,
    height: WORLD_CONFIG.mapHeight,
    heightLevels: levels,
    seed: 1,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  };
}

function latticeHeight(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function expectedPositions(terrain: TerrainSnapshot, cell: CellCoord): number[] {
  return [
    { x: cell.x, z: cell.z },
    { x: cell.x + 1, z: cell.z },
    { x: cell.x, z: cell.z + 1 },
    { x: cell.x + 1, z: cell.z + 1 },
  ].flatMap((coord) => {
    const world = vertexToWorld(coord, latticeHeight(terrain, coord.x, coord.z), WORLD_CONFIG);
    return [world.x, world.y + 0.02, world.z];
  });
}

describe('buildSelectedCellOverlayData', () => {
  it('uses authoritative lattice heights and the accepted terrain diagonal', () => {
    const terrain = snapshot();
    const cell = { x: 4, z: 7 } as const;
    const data = buildSelectedCellOverlayData(terrain, cell, WORLD_CONFIG);
    const corners = {
      nw: latticeHeight(terrain, 4, 7),
      ne: latticeHeight(terrain, 5, 7),
      sw: latticeHeight(terrain, 4, 8),
      se: latticeHeight(terrain, 5, 8),
    };

    expect(Array.from(data.positions)).toEqual(expectedPositions(terrain, cell));
    expect(Array.from(data.indices)).toEqual(
      selectTerrainDiagonal(corners) === 'sw-ne' ? [2, 3, 1, 2, 1, 0] : [2, 3, 0, 3, 1, 0],
    );
    expect(data.cell).toEqual(cell);
    expect(data.terrainRevision).toBe(0);
  });

  it('rejects cells outside the authoritative map', () => {
    expect(() =>
      buildSelectedCellOverlayData(snapshot(), { x: 128, z: 0 }, WORLD_CONFIG),
    ).toThrowError(expect.objectContaining({ code: 'selection:invalid-cell' }));
  });
});

describe('SelectedCellPresentation', () => {
  it('publishes one overlay root, avoids identical rebuilds, and clears selection', () => {
    const scene = new THREE.Scene();
    const presentation = new SelectedCellPresentation(scene, WORLD_CONFIG);
    const terrain = snapshot();

    presentation.setSelection(terrain, { x: 4, z: 7 });
    const root = presentation.object3d;
    expect(scene.children).toEqual([root]);
    expect(presentation.visible).toBe(true);

    presentation.setSelection(terrain, { x: 4, z: 7 });
    expect(presentation.object3d).toBe(root);

    presentation.clear();
    expect(presentation.visible).toBe(false);
  });

  it('rebuilds for a new Terrain revision and disposes owned resources idempotently', () => {
    const scene = new THREE.Scene();
    const presentation = new SelectedCellPresentation(scene, WORLD_CONFIG);
    presentation.setSelection(snapshot(0), { x: 4, z: 7 });
    const root = presentation.object3d;
    const geometry = (root.children[0] as THREE.Mesh).geometry;
    const dispose = vi.spyOn(geometry, 'dispose');

    presentation.setSelection(snapshot(1), { x: 4, z: 7 });
    expect(presentation.object3d).not.toBe(root);
    expect(dispose).toHaveBeenCalledOnce();

    presentation.dispose();
    presentation.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
