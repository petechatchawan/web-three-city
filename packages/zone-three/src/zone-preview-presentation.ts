import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  EMPTY_ZONE_CODE,
  createZoneSnapshot,
  zoneDefinitionForId,
  type ZoneMutationPlan,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import * as THREE from 'three';
import { createZoneGeometry } from './geometry-adapter.js';
import {
  createZoneMaterials,
  disposeZoneMaterials,
  type ZoneMaterials,
} from './material-factory.js';
import { buildZoneOverlayMesh, type ZoneSurfaceAt } from './zone-overlay-geometry.js';

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
    }
  });
  root.clear();
}

function previewMaterial(plan: ZoneMutationPlan, materials: ZoneMaterials): THREE.MeshBasicMaterial {
  if (plan.operation === 'paint') {
    return plan.valid ? materials.paintValidPreview : materials.paintInvalidPreview;
  }
  return plan.valid ? materials.removeValidPreview : materials.removeInvalidPreview;
}

function previewSnapshot(
  baseZones: ZoneSnapshot,
  plan: ZoneMutationPlan,
  config: WorldConfig,
): ZoneSnapshot {
  if (plan.valid && plan.operation === 'paint') {
    return createZoneSnapshot(
      {
        width: config.mapWidth,
        height: config.mapHeight,
        revision: plan.baseZoneRevision,
        definitionCodes: plan.proposedDefinitionCodes,
      },
      config,
    );
  }
  if (plan.operation === 'remove') return baseZones;

  const codes = baseZones.definitionCodes;
  const code = plan.definitionId === null ? 1 : zoneDefinitionForId(plan.definitionId).code;
  for (const cell of plan.requestedCells) {
    const index = cell.z * config.mapWidth + cell.x;
    if (codes[index] === EMPTY_ZONE_CODE) codes[index] = code;
  }
  return createZoneSnapshot(
    {
      width: config.mapWidth,
      height: config.mapHeight,
      revision: plan.baseZoneRevision,
      definitionCodes: codes,
    },
    config,
  );
}

function invalidMarkerGeometry(
  cells: readonly CellCoord[],
  surfaceAt: ZoneSurfaceAt,
  config: WorldConfig,
): THREE.BufferGeometry | null {
  if (cells.length === 0) return null;
  const positions: number[] = [];
  const inset = config.cellSize * 0.22;
  for (const cell of cells) {
    const surface = surfaceAt(cell);
    const minX = (cell.x - config.mapWidth / 2) * config.cellSize + inset;
    const maxX = (cell.x - config.mapWidth / 2 + 1) * config.cellSize - inset;
    const minZ = (cell.z - config.mapHeight / 2) * config.cellSize + inset;
    const maxZ = (cell.z - config.mapHeight / 2 + 1) * config.cellSize - inset;
    const y = surface.maximumLevel * config.heightStep + 0.08;
    positions.push(minX, y, minZ, maxX, y, maxZ, minX, y, maxZ, maxX, y, minZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export class ZonePreviewPresentation {
  readonly #scene: THREE.Scene;
  readonly #surfaceAt: ZoneSurfaceAt;
  readonly #config: WorldConfig;
  readonly #materials = createZoneMaterials();
  #root: THREE.Group | null = null;
  #disposed = false;

  constructor(scene: THREE.Scene, surfaceAt: ZoneSurfaceAt, config: WorldConfig) {
    this.#scene = scene;
    this.#surfaceAt = surfaceAt;
    this.#config = config;
  }

  get root(): THREE.Group | null {
    return this.#root;
  }

  show(baseZones: ZoneSnapshot, plan: ZoneMutationPlan): void {
    this.#assertUsable();
    const staged = new THREE.Group();
    staged.name = plan.valid ? 'zone-preview-root-valid' : 'zone-preview-root-invalid';
    try {
      const cells = plan.valid ? plan.changedCells : plan.requestedCells;
      const snapshot = previewSnapshot(baseZones, plan, this.#config);
      const data = buildZoneOverlayMesh(snapshot, cells, this.#surfaceAt, this.#config);
      if (data.positions.length > 0) {
        const mesh = new THREE.Mesh(
          createZoneGeometry(data, false),
          previewMaterial(plan, this.#materials),
        );
        mesh.name = plan.valid
          ? `zone-preview-${plan.operation}-valid-surface`
          : 'zone-preview-invalid-surface';
        staged.add(mesh);
      }
      if (!plan.valid) {
        const markerGeometry = invalidMarkerGeometry(
          plan.invalidCells.map((entry) => entry.cell),
          this.#surfaceAt,
          this.#config,
        );
        if (markerGeometry !== null) {
          const marker = new THREE.LineSegments(markerGeometry, this.#materials.invalidMarker);
          marker.name = 'zone-preview-invalid-marker';
          staged.add(marker);
        }
      }
    } catch (error) {
      disposeRoot(staged);
      throw error;
    }

    const previous = this.#root;
    this.#scene.add(staged);
    this.#root = staged;
    if (previous !== null) {
      this.#scene.remove(previous);
      disposeRoot(previous);
    }
  }

  clear(): void {
    this.#assertUsable();
    if (this.#root === null) return;
    this.#scene.remove(this.#root);
    disposeRoot(this.#root);
    this.#root = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    if (this.#root !== null) {
      this.#scene.remove(this.#root);
      disposeRoot(this.#root);
      this.#root = null;
    }
    disposeZoneMaterials(this.#materials);
    this.#disposed = true;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('zone-preview:disposed');
  }
}
