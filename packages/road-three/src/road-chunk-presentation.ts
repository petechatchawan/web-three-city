import type { RoadPlacementEnvironment, RoadSnapshot } from '@web-three-city/road-core';
import { allChunkCoords, type ChunkCoord } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createRoadGeometry } from './geometry-adapter.js';
import { createRoadMaterials } from './material-factory.js';
import { mergeRoadCellMeshes } from './road-geometry.js';
import type { RoadMeshData } from './road-mesh-data.js';

const RENDER_PAGE_CHUNK_SPAN = 2;

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

function pageCoord(chunk: ChunkCoord): ChunkCoord {
  return {
    x: Math.floor(chunk.x / RENDER_PAGE_CHUNK_SPAN) * RENDER_PAGE_CHUNK_SPAN,
    z: Math.floor(chunk.z / RENDER_PAGE_CHUNK_SPAN) * RENDER_PAGE_CHUNK_SPAN,
  };
}

function pageKey(page: ChunkCoord): string {
  return `${page.x}:${page.z}`;
}

function pageCoords(config: WorldConfig): readonly ChunkCoord[] {
  const pages = new Map<string, ChunkCoord>();
  for (const chunk of allChunkCoords(config)) {
    const page = pageCoord(chunk);
    pages.set(pageKey(page), page);
  }
  return sortedChunks([...pages.values()]);
}

function chunksInPage(page: ChunkCoord, config: WorldConfig): readonly ChunkCoord[] {
  return allChunkCoords(config).filter(
    (chunk) => pageCoord(chunk).x === page.x && pageCoord(chunk).z === page.z,
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
  readonly #pages = new Map<string, THREE.Object3D>();
  readonly #chunkToPage = new Map<string, string>();
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
      for (const page of pageCoords(this.#config)) {
        staged.set(pageKey(page), this.#buildPageObject(roads, environment, page));
      }
    } catch (error) {
      for (const object of staged.values()) disposeObject(object);
      throw error;
    }

    const previous = [...this.#pages.values()];
    for (const object of staged.values()) this.#root.add(object);
    for (const object of previous) this.#root.remove(object);
    this.#pages.clear();
    for (const [key, object] of staged) this.#pages.set(key, object);
    this.#chunkToPage.clear();
    for (const chunk of allChunkCoords(this.#config)) {
      this.#chunkToPage.set(chunkKey(chunk), pageKey(pageCoord(chunk)));
    }
    for (const object of previous) disposeObject(object);
  }

  rebuildDirty(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    chunks: readonly ChunkCoord[],
  ): void {
    this.#assertUsable();
    const ordered = sortedChunks(chunks);
    const pages = new Map<string, ChunkCoord>();
    for (const chunk of ordered) {
      const key = chunkKey(chunk);
      const owningPage = this.#chunkToPage.get(key);
      if (owningPage === undefined) throw new Error(`road-presentation:missing-chunk:${key}`);
      pages.set(owningPage, pageCoord(chunk));
    }
    const replacements = new Map<string, THREE.Object3D>();
    try {
      for (const [key, page] of pages) {
        if (!this.#pages.has(key)) throw new Error(`road-presentation:missing-page:${key}`);
        replacements.set(key, this.#buildPageObject(roads, environment, page));
      }
    } catch (error) {
      for (const object of replacements.values()) disposeObject(object);
      throw error;
    }

    const previous: THREE.Object3D[] = [];
    for (const [key, replacement] of replacements) {
      const old = this.#pages.get(key)!;
      this.#root.add(replacement);
      this.#root.remove(old);
      this.#pages.set(key, replacement);
      previous.push(old);
    }
    for (const object of previous) disposeObject(object);
  }

  getChunkObject(chunk: ChunkCoord): THREE.Object3D {
    this.#assertUsable();
    const owningPage = this.#chunkToPage.get(chunkKey(chunk));
    const object = owningPage === undefined ? undefined : this.#pages.get(owningPage);
    if (object === undefined) throw new Error(`road-presentation:missing-chunk:${chunkKey(chunk)}`);
    return object;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#scene.remove(this.#root);
    for (const object of this.#pages.values()) disposeObject(object);
    this.#pages.clear();
    this.#chunkToPage.clear();
    this.#root.clear();
    this.#materials.committed.dispose();
    this.#materials.buildValidPreview.dispose();
    this.#materials.buildInvalidPreview.dispose();
    this.#materials.invalidMarker.dispose();
  }

  #buildPageObject(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    page: ChunkCoord,
  ): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `road-page:${pageKey(page)}`;
    const data = mergeRoadCellMeshes(
      chunksInPage(page, this.#config).map((chunk) =>
        this.#source.buildChunk(roads, environment, chunk),
      ),
    );
    if (data.positions.length > 0) {
      group.add(new THREE.Mesh(createRoadGeometry(data), this.#materials.committed));
    }
    return group;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('road-presentation:disposed');
  }
}
