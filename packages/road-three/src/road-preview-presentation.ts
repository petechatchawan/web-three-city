import {
  BASIC_ROAD_DEFINITION,
  createRoadSnapshot,
  type RoadCellView,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createRoadGeometry } from './geometry-adapter.js';
import { createRoadMaterials } from './material-factory.js';
import { buildRoadCellMesh, mergeRoadCellMeshes } from './road-geometry.js';
import type { RoadPresentationSource } from './road-chunk-presentation.js';

function sortedChunks(chunks: readonly ChunkCoord[]): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()].sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  root.clear();
}

export class RoadPreviewPresentation {
  readonly #scene: THREE.Scene;
  readonly #source: RoadPresentationSource;
  readonly #config: WorldConfig;
  readonly #materials = createRoadMaterials();
  #root: THREE.Group | null = null;
  #disposed = false;

  constructor(scene: THREE.Scene, source: RoadPresentationSource, config: WorldConfig) {
    this.#scene = scene;
    this.#source = source;
    this.#config = config;
  }

  show(plan: RoadMutationPlan, environment: RoadPlacementEnvironment): void {
    this.#assertUsable();
    const staged = new THREE.Group();
    staged.name = plan.valid ? 'road-preview-root-valid' : 'road-preview-root-invalid';
    const material = plan.valid ? this.#materials.validPreview : this.#materials.invalidPreview;

    try {
      if (plan.valid) {
        const snapshot = createRoadSnapshot(
          {
            width: this.#config.mapWidth,
            height: this.#config.mapHeight,
            revision: plan.baseRoadRevision,
            definitionCodes: plan.proposedDefinitionCodes,
          },
          this.#config,
        );
        const chunks = sortedChunks(
          plan.dirtyChunks.length > 0
            ? plan.dirtyChunks
            : plan.requestedCells.map((cell) => chunkForCell(cell, this.#config)),
        );
        for (const chunk of chunks) {
          const data = this.#source.buildChunk(snapshot, environment, chunk);
          if (data.positions.length > 0) {
            staged.add(new THREE.Mesh(createRoadGeometry(data), material));
          }
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
          staged.add(new THREE.Mesh(createRoadGeometry(data), material));
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
    this.#disposed = true;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('road-preview:disposed');
  }
}
