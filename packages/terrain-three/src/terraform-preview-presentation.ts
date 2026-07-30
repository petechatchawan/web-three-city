import type { TerrainCorner } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import {
  TERRAFORM_PREVIEW_Y_OFFSET,
  buildTerraformPreviewMesh,
  type TerraformPreviewLayerMeshData,
} from './terraform-preview-geometry.js';
import {
  terraformPreviewModelEmpty,
  validateTerraformPreviewSceneModel,
  type ProjectedTerrainCell,
  type TerraformPreviewSceneModel,
} from './terraform-preview-model.js';

const CORNER_OFFSETS: Readonly<Record<TerrainCorner, Readonly<{ x: number; z: number }>>> =
  Object.freeze({
    nw: Object.freeze({ x: 0, z: 0 }),
    ne: Object.freeze({ x: 1, z: 0 }),
    sw: Object.freeze({ x: 0, z: 1 }),
    se: Object.freeze({ x: 1, z: 1 }),
  });

function createGeometry(data: TerraformPreviewLayerMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function worldCorner(
  projected: ProjectedTerrainCell,
  corner: TerrainCorner,
  config: WorldConfig,
): readonly [number, number, number] {
  const offset = CORNER_OFFSETS[corner];
  return [
    (projected.cell.x + offset.x - config.mapWidth / 2) * config.cellSize,
    projected.corners[corner] * config.heightStep + TERRAFORM_PREVIEW_Y_OFFSET + 0.01,
    (projected.cell.z + offset.z - config.mapHeight / 2) * config.cellSize,
  ];
}

function createRejectedMarkerGeometry(
  cells: readonly ProjectedTerrainCell[],
  config: WorldConfig,
): THREE.BufferGeometry | null {
  if (cells.length === 0) return null;
  const positions: number[] = [];
  for (const projected of cells) {
    positions.push(
      ...worldCorner(projected, 'nw', config),
      ...worldCorner(projected, 'se', config),
      ...worldCorner(projected, 'ne', config),
      ...worldCorner(projected, 'sw', config),
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
    }
  });
  root.clear();
}

export class TerraformPreviewPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #surfaceMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.52,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  readonly #waterMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.26,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  readonly #rejectedMarkerMaterial = new THREE.LineBasicMaterial({
    color: 0x7d1111,
    transparent: true,
    opacity: 0.94,
    depthTest: true,
    depthWrite: false,
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

  show(model: TerraformPreviewSceneModel): void {
    this.#assertUsable();
    validateTerraformPreviewSceneModel(model);
    if (terraformPreviewModelEmpty(model)) {
      this.clear();
      return;
    }

    const data = buildTerraformPreviewMesh(model, this.#config);
    const stagedRoot = new THREE.Group();
    stagedRoot.name = 'terraform-preview-root';

    const addLayer = (
      layer: TerraformPreviewLayerMeshData,
      name: string,
      material: THREE.Material,
    ): void => {
      if (layer.cellCount === 0) return;
      const mesh = new THREE.Mesh(createGeometry(layer), material);
      mesh.name = name;
      stagedRoot.add(mesh);
    };

    try {
      addLayer(data.core, 'terraform-preview-core', this.#surfaceMaterial);
      addLayer(data.support, 'terraform-preview-support', this.#surfaceMaterial);
      addLayer(data.rejected, 'terraform-preview-rejected', this.#surfaceMaterial);
      addLayer(data.noChange, 'terraform-preview-no-change', this.#surfaceMaterial);
      addLayer(data.water, 'terraform-preview-water', this.#waterMaterial);
      const markerGeometry = createRejectedMarkerGeometry(
        model.rejectedStampCells,
        this.#config,
      );
      if (markerGeometry !== null) {
        const marker = new THREE.LineSegments(markerGeometry, this.#rejectedMarkerMaterial);
        marker.name = 'terraform-preview-rejected-marker';
        stagedRoot.add(marker);
      }
    } catch (error) {
      disposeRoot(stagedRoot);
      throw error;
    }

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
    this.#surfaceMaterial.dispose();
    this.#waterMaterial.dispose();
    this.#rejectedMarkerMaterial.dispose();
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('terraform-preview:disposed');
  }
}
