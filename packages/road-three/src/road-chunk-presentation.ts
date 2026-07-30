import type {
  RoadPlacementEnvironment,
  RoadSnapshot,
} from '@web-three-city/road-core';
import { allChunkCoords, type ChunkCoord } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createRoadGeometry } from './geometry-adapter.js';
import { createRoadMaterials } from './material-factory.js';
import type { RoadMeshData } from './road-mesh-data.js';

export interface RoadPresentationSource {
  buildChunk(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    chunk: ChunkCoord,
  ): RoadMeshData;
}

function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.x}:${chunk.z}`;
}

function sortedChunks(chunks: readonly ChunkCoord[]): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(chunkKey(chunk), chunk);
  return Object.freeze(
    [...unique.values()].sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((candidate) => {
    if (candidate instanceof THREE.Mesh) candidate.geometry.dispose();
  });
  object.clear();
}

export class RoadChunkPresentation {
  readonly #scene: THREE.Scene;
  readonly #source: RoadPresentationSource;
  readonly #config: WorldConfig;
  readonly #materials = createRoadMaterials();
  readonly #root = new THREE.Group();
  readonly #chunks = new Map<string, THREE.Object3D>();
  #disposed = false;

  constructor(scene: THREE.Scene, source: RoadPresentationSource, config: WorldConfig) {
    this.#scene = scene;
    this.#source = source;
    this.#config = config;
    this.#root.name = 'road-committed-root';
    this.#scene.add(this.#root);
  }

  loadAll(roads: RoadSnapshot, environment: RoadPlacementEnvironment): void {
    this.#assertUsable();
    const staged = new Map<string, THREE.Object3D>();
    try {
      for (const chunk of allChunkCoords(this.#config)) {
        staged.set(chunkKey(chunk), this.#buildChunkObject(roads, environment, chunk));
      }
    } catch (error) {
      for (const object of staged.values()) disposeObject(object);
      throw error;
    }

    const previous = [...this.#chunks.values()];
    for (const object of staged.values()) this.#root.add(object);
    for (const object of previous) this.#root.remove(object);
    this.#chunks.clear();
    for (const [key, object] of staged) this.#chunks.set(key, object);
    for (const object of previous) disposeObject(object);
  }

  rebuildDirty(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    chunks: readonly ChunkCoord[],
  ): void {
    this.#assertUsable();
    const ordered = sortedChunks(chunks);
    const replacements = new Map<string, THREE.Object3D>();
    try {
      for (const chunk of ordered) {
        const key = chunkKey(chunk);
        if (!this.#chunks.has(key)) throw new Error(`road-presentation:missing-chunk:${key}`);
        replacements.set(key, this.#buildChunkObject(roads, environment, chunk));
      }
    } catch (error) {
      for (const object of replacements.values()) disposeObject(object);
      throw error;
    }

    const previous: THREE.Object3D[] = [];
    for (const [key, replacement] of replacements) {
      const old = this.#chunks.get(key)!;
      this.#root.add(replacement);
      this.#root.remove(old);
      this.#chunks.set(key, replacement);
      previous.push(old);
    }
    for (const object of previous) disposeObject(object);
  }

  getChunkObject(chunk: ChunkCoord): THREE.Object3D {
    this.#assertUsable();
    const object = this.#chunks.get(chunkKey(chunk));
    if (object === undefined) throw new Error(`road-presentation:missing-chunk:${chunkKey(chunk)}`);
    return object;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#scene.remove(this.#root);
    for (const object of this.#chunks.values()) disposeObject(object);
    this.#chunks.clear();
    this.#root.clear();
    this.#materials.committed.dispose();
    this.#materials.validPreview.dispose();
    this.#materials.invalidPreview.dispose();
    this.#materials.invalidMarker.dispose();
  }

  #buildChunkObject(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    chunk: ChunkCoord,
  ): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `road-chunk:${chunkKey(chunk)}`;
    const data = this.#source.buildChunk(roads, environment, chunk);
    if (data.positions.length > 0) {
      group.add(new THREE.Mesh(createRoadGeometry(data), this.#materials.committed));
    }
    return group;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('road-presentation:disposed');
  }
}
