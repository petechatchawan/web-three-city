import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  TerraformPreviewPresentation,
  type ProjectedTerrainCell,
  type TerraformPreviewSceneModel,
} from '../src/index.js';

function projectedCell(x: number, z: number, level = 1): ProjectedTerrainCell {
  return Object.freeze({
    cell: Object.freeze({ x, z }),
    corners: Object.freeze({ nw: level, ne: level, sw: level, se: level }),
  });
}

function model(secondCore = false): TerraformPreviewSceneModel {
  return {
    acceptedCoreCells: secondCore
      ? [projectedCell(10, 10), projectedCell(11, 10)]
      : [projectedCell(10, 10)],
    propagatedSupportCells: [projectedCell(10, 11)],
    rejectedStampCells: [projectedCell(12, 10, 2)],
    noChangeCells: [projectedCell(12, 11)],
    projectedWetCells: [{ x: 10, z: 12 }],
    projectedDryCells: [],
    projectedShorelineCells: [{ x: 11, z: 12 }],
  };
}

describe('TerraformPreviewPresentation', () => {
  it('creates stable semantic layer and rejected-marker names', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(model());

    expect(preview.object3d.name).toBe('terraform-preview-root');
    expect(preview.object3d.getObjectByName('terraform-preview-core')).toBeInstanceOf(THREE.Mesh);
    expect(preview.object3d.getObjectByName('terraform-preview-support')).toBeInstanceOf(
      THREE.Mesh,
    );
    expect(preview.object3d.getObjectByName('terraform-preview-rejected')).toBeInstanceOf(
      THREE.Mesh,
    );
    expect(preview.object3d.getObjectByName('terraform-preview-no-change')).toBeInstanceOf(
      THREE.Mesh,
    );
    expect(preview.object3d.getObjectByName('terraform-preview-water')).toBeInstanceOf(THREE.Mesh);
    expect(preview.object3d.getObjectByName('terraform-preview-rejected-marker')).toBeInstanceOf(
      THREE.LineSegments,
    );
    expect(scene.children.filter((node) => node.name === 'terraform-preview-root')).toHaveLength(1);
  });

  it('keeps depth testing enabled for preview surfaces and markers', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(model());

    const core = preview.object3d.getObjectByName('terraform-preview-core') as THREE.Mesh;
    const marker = preview.object3d.getObjectByName(
      'terraform-preview-rejected-marker',
    ) as THREE.LineSegments;
    expect((core.material as THREE.MeshBasicMaterial).depthTest).toBe(true);
    expect((marker.material as THREE.LineBasicMaterial).depthTest).toBe(true);
  });

  it('atomically replaces one root and disposes previous geometry', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(model());
    const firstRoot = preview.object3d;
    const firstMesh = firstRoot.getObjectByName('terraform-preview-core') as THREE.Mesh;
    const dispose = vi.spyOn(firstMesh.geometry, 'dispose');

    preview.show(model(true));

    expect(preview.object3d).not.toBe(firstRoot);
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene.children.filter((node) => node.name === 'terraform-preview-root')).toHaveLength(1);
  });

  it('clears and disposes idempotently', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(model());
    preview.clear();
    preview.clear();

    expect(scene.children).toHaveLength(0);
    expect(preview.visible).toBe(false);
  });

  it('disposes idempotently and rejects later use', () => {
    const scene = new THREE.Scene();
    const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
    preview.show(model());
    preview.dispose();
    preview.dispose();

    expect(scene.children).toHaveLength(0);
    expect(() => preview.show(model())).toThrowError('terraform-preview:disposed');
  });
});
