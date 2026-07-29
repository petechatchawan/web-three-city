import type { TerraformPlan } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TerraformPreviewPresentation } from '../src/index.js';

function plan(cellCount: 1 | 2 = 1): TerraformPlan {
  const cells =
    cellCount === 1
      ? [{ x: 10, z: 10 }]
      : [
          { x: 10, z: 10 },
          { x: 11, z: 10 },
        ];
  return {
    operation: 'raise',
    brushSize: 1,
    baseTerrainRevision: 1,
    affectedCells: cells,
    affectedVertices: [],
    proposedHeightLevels: new Uint8Array(
      (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1),
    ).fill(1),
    changedVertexCount: 4,
    dirtyRegion: {
      minVertexX: 10,
      minVertexZ: 10,
      maxVertexX: 12,
      maxVertexZ: 11,
    },
    valid: true,
    invalidReason: null,
  };
}

describe('TerraformPreviewPresentation', () => {
  it('creates the locked root, mesh name, and render order', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(plan());

    expect(preview.object3d.name).toBe('terraform-preview-root');
    const mesh = preview.object3d.getObjectByName('terraform-preview-surface');
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh?.renderOrder).toBe(15);
    expect(scene.children.filter((node) => node.name === 'terraform-preview-root')).toHaveLength(1);
  });

  it('atomically replaces one root and disposes previous geometry', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(plan(1));
    const firstRoot = preview.object3d;
    const firstMesh = firstRoot.getObjectByName('terraform-preview-surface') as THREE.Mesh;
    const dispose = vi.spyOn(firstMesh.geometry, 'dispose');

    preview.show(plan(2));

    expect(preview.object3d).not.toBe(firstRoot);
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene.children.filter((node) => node.name === 'terraform-preview-root')).toHaveLength(1);
  });

  it('clears and disposes idempotently', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(plan());
    preview.clear();
    preview.clear();

    expect(scene.children).toHaveLength(0);
    expect(preview.visible).toBe(false);
  });

  it('disposes idempotently and rejects later use', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(plan());
    preview.dispose();
    preview.dispose();

    expect(scene.children).toHaveLength(0);
    expect(() => preview.show(plan())).toThrowError('terraform-preview:disposed');
  });
});
