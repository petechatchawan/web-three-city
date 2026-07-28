import type { TerraformPlan } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { buildTerraformPreviewMesh } from './terraform-preview-geometry.js';

function createGeometry(plan: TerraformPlan, config: WorldConfig): THREE.BufferGeometry {
  const data = buildTerraformPreviewMesh(plan, config);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  root.clear();
}

export class TerraformPreviewPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.52,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  #root: THREE.Group | null = null;
  #disposed = false;

  constructor(scene: THREE.Scene, config: WorldConfig) {
    this.#scene = scene;
    this.#config = config;
  }

  get visible(): boolean {
    return this.#root !== null;
  }

  get object3d(): THREE.Group {
    this.#assertUsable();
    if (this.#root === null) throw new Error('terraform-preview:not-visible');
    return this.#root;
  }

  show(plan: TerraformPlan): void {
    this.#assertUsable();
    if (plan.affectedCells.length === 0) {
      this.clear();
      return;
    }

    const geometry = createGeometry(plan, this.#config);
    const stagedRoot = new THREE.Group();
    stagedRoot.name = 'terraform-preview-root';
    const mesh = new THREE.Mesh(geometry, this.#material);
    mesh.name = 'terraform-preview-surface';
    mesh.renderOrder = 15;
    stagedRoot.add(mesh);

    const previousRoot = this.#root;
    this.#scene.add(stagedRoot);
    this.#root = stagedRoot;
    if (previousRoot !== null) {
      this.#scene.remove(previousRoot);
      disposeRoot(previousRoot);
    }
  }

  clear(): void {
    if (this.#root === null) return;
    this.#scene.remove(this.#root);
    disposeRoot(this.#root);
    this.#root = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clear();
    this.#material.dispose();
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('terraform-preview:disposed');
  }
}
