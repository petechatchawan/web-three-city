import {
  BASIC_ROAD_DEFINITION,
  createRoadSnapshot,
  roadCellViewAt,
  type RoadCellView,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createRoadGeometry } from './geometry-adapter.js';
import { createRoadMaterials } from './material-factory.js';
import { buildRoadCellMesh, mergeRoadCellMeshes } from './road-geometry.js';
import { buildRoadInvalidMarker } from './road-invalid-marker.js';
import type { RoadPresentationSource } from './road-chunk-presentation.js';

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
    }
  });
  root.clear();
}

export class RoadPreviewPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #materials = createRoadMaterials();
  #root: THREE.Group | null = null;
  #disposed = false;

  constructor(scene: THREE.Scene, _source: RoadPresentationSource, config: WorldConfig) {
    this.#scene = scene;
    this.#config = config;
  }

  show(
    baseRoads: RoadSnapshot,
    plan: RoadMutationPlan,
    environment: RoadPlacementEnvironment,
  ): void {
    this.#assertUsable();
    const staged = new THREE.Group();
    staged.name = plan.valid ? 'road-preview-root-valid' : 'road-preview-root-invalid';
    const material = plan.valid ? this.#materials.validPreview : this.#materials.invalidPreview;

    try {
      if (plan.valid) {
        const sourceSnapshot =
          plan.operation === 'build'
            ? createRoadSnapshot(
                {
                  width: this.#config.mapWidth,
                  height: this.#config.mapHeight,
                  revision: plan.baseRoadRevision,
                  definitionCodes: plan.proposedDefinitionCodes,
                },
                this.#config,
              )
            : baseRoads;
        const cells = plan.operation === 'build' ? plan.addedCells : plan.removedCells;
        const views: RoadCellView[] = [];
        for (const cell of cells) {
          const view = roadCellViewAt(sourceSnapshot, cell, environment, this.#config);
          if (view !== null) views.push(view);
        }
        const data = mergeRoadCellMeshes(
          views.map((view) => buildRoadCellMesh(view, this.#config)),
        );
        if (data.positions.length > 0) {
          staged.add(new THREE.Mesh(createRoadGeometry(data), material));
        }
      } else {
        const views: RoadCellView[] = plan.requestedCells.map((cell) =>
          Object.freeze({
            cell: Object.freeze({ x: cell.x, z: cell.z }),
            definition: BASIC_ROAD_DEFINITION,
            connections: 0,
            surface: environment.surfaceAt(cell),
          }),
        );
        const data = mergeRoadCellMeshes(
          views.map((view) => buildRoadCellMesh(view, this.#config)),
        );
        if (data.positions.length > 0) {
          const invalidMesh = new THREE.Mesh(createRoadGeometry(data), material);
          invalidMesh.name = 'road-preview-invalid-surface';
          staged.add(invalidMesh);
        }
        const markerData = buildRoadInvalidMarker(plan, environment, this.#config);
        if (markerData.segmentCount > 0) {
          const markerGeometry = new THREE.BufferGeometry();
          markerGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(markerData.positions, 3),
          );
          markerGeometry.computeBoundingBox();
          markerGeometry.computeBoundingSphere();
          const marker = new THREE.LineSegments(markerGeometry, this.#materials.invalidMarker);
          marker.name = 'road-preview-invalid-marker';
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

  get root(): THREE.Group | null {
    return this.#root;
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
    this.#materials.committed.dispose();
    this.#materials.validPreview.dispose();
    this.#materials.invalidPreview.dispose();
    this.#materials.invalidMarker.dispose();
    this.#disposed = true;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('road-preview:disposed');
  }
}
