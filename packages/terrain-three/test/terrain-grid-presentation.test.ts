import { allChunkCoords, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TerrainGridPresentation, buildTerrainGridChunkData } from '../src/index.js';

function snapshot(revision = 0): TerrainSnapshot {
  const width = WORLD_CONFIG.mapWidth + 1;
  const levels = new Uint8Array(width * (WORLD_CONFIG.mapHeight + 1));
  for (let z = 0; z <= WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x <= WORLD_CONFIG.mapWidth; x += 1) {
      levels[z * width + x] = 1 + ((x + z) % 4);
    }
  }
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

function boundaryTriples(data: { readonly positions: Float32Array }, worldX: number): string[] {
  const result = new Set<string>();
  for (let index = 0; index < data.positions.length; index += 3) {
    if (Math.abs(data.positions[index]! - worldX) <= 1e-6) {
      result.add(
        `${data.positions[index]!.toFixed(6)},${data.positions[index + 1]!.toFixed(6)},${data.positions[index + 2]!.toFixed(6)}`,
      );
    }
  }
  return [...result].sort();
}

describe('buildTerrainGridChunkData', () => {
  it('emits every authoritative lattice edge exactly once', () => {
    const terrain = snapshot();
    const total = allChunkCoords(WORLD_CONFIG)
      .map((chunk) => buildTerrainGridChunkData(terrain, chunk, WORLD_CONFIG).segmentCount)
      .reduce((sum, count) => sum + count, 0);

    expect(total).toBe(2 * 128 * 129);
  });

  it('uses authoritative heights plus the locked grid offset', () => {
    const terrain = snapshot();
    const data = buildTerrainGridChunkData(terrain, { x: 0, z: 0 }, WORLD_CONFIG);
    const firstY = terrain.heightLevels[0]! * WORLD_CONFIG.heightStep + 0.015;

    expect(data.positions[1]).toBeCloseTo(firstY);
    expect(data.positions.length).toBe(data.segmentCount * 2 * 3);
    expect(data.chunk).toEqual({ x: 0, z: 0 });
    expect(data.terrainRevision).toBe(0);
  });

  it('preserves identical endpoint positions at a vertical chunk seam', () => {
    const terrain = snapshot();
    const west = buildTerrainGridChunkData(terrain, { x: 0, z: 0 }, WORLD_CONFIG);
    const east = buildTerrainGridChunkData(terrain, { x: 1, z: 0 }, WORLD_CONFIG);
    const seamWorldX = (16 - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;

    expect(boundaryTriples(west, seamWorldX)).toEqual(boundaryTriples(east, seamWorldX));
  });
});

describe('TerrainGridPresentation', () => {
  it('loads chunked grid geometry and toggles visibility without replacing its root', () => {
    const scene = new THREE.Scene();
    const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);

    grid.load(snapshot());
    const root = grid.object3d;
    expect(scene.children).toEqual([root]);
    expect(root.children).toHaveLength(64);

    grid.setVisible(false);
    expect(grid.visible).toBe(false);
    expect(grid.object3d).toBe(root);

    grid.setVisible(true);
    expect(grid.visible).toBe(true);
    expect(grid.object3d).toBe(root);
  });

  it('rebuilds only requested chunks and disposes resources idempotently', () => {
    const scene = new THREE.Scene();
    const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
    grid.load(snapshot(0));
    const root = grid.object3d;
    const first = root.children[0] as THREE.LineSegments;
    const second = root.children[1];
    const dispose = vi.spyOn(first.geometry, 'dispose');

    grid.rebuild(snapshot(1), [{ x: 0, z: 0 }]);

    expect(grid.object3d.children[0]).not.toBe(first);
    expect(grid.object3d.children[1]).toBe(second);
    expect(dispose).toHaveBeenCalledOnce();

    grid.dispose();
    grid.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
