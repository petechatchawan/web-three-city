import {
  allChunkCoords,
  chunkCellBounds,
  type ChunkCoord,
} from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { zoneOccupiedAt, type ZoneSnapshot } from '@web-three-city/zone-core';
import * as THREE from 'three';
import { createZoneGeometry } from './geometry-adapter.js';
import { createZoneMaterials, disposeZoneMaterials } from './material-factory.js';
import { buildZoneOverlayMesh, type ZoneSurfaceAt } from './zone-overlay-geometry.js';
import type { ZoneMeshData } from './zone-mesh-data.js';

export interface ZonePresentationSource {
  buildChunk(zones: ZoneSnapshot, chunk: ChunkCoord): ZoneMeshData;
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
    if (candidate instanceof THREE.Mesh || candidate instanceof THREE.LineSegments) {
      candidate.geometry.dispose();
    }
  });
  object.clear();
}

export function createCoreZonePresentationSource(
  surfaceAt: ZoneSurfaceAt,
  config: WorldConfig,
): ZonePresentationSource {
  return Object.freeze({
    buildChunk(zones: ZoneSnapshot, chunk: ChunkCoord): ZoneMeshData {
      const bounds = chunkCellBounds(chunk, config);
      const cells: CellCoord[] = [];
      for (let z = bounds.minCellZ; z <= bounds.maxCellZ; z += 1) {
        for (let x = bounds.minCellX; x <= bounds.maxCellX; x += 1) {
          const cell = { x, z };
          if (zoneOccupiedAt(zones, cell)) cells.push(cell);
        }
      }
      return buildZoneOverlayMesh(zones, cells, surfaceAt, config);
    },
  });
}

export class ZoneChunkPresentation {
  readonly #scene: THREE.Scene;
  readonly #source: ZonePresentationSource;
  readonly #config: WorldConfig;
  readonly #materials = createZoneMaterials();
  readonly #root = new THREE.Group();
  readonly #chunks = new Map<string, THREE.Object3D>();
  #disposed = false;

  constructor(scene: THREE.Scene, source: ZonePresentationSource, config: WorldConfig) {
    this.#scene = scene;
    this.#source = source;
    this.#config = config;
    this.#root.name = 'zone-committed-root';
    this.#scene.add(this.#root);
  }

  get chunkCount(): number {
    return this.#chunks.size;
  }

  loadAll(zones: ZoneSnapshot): void {
    this.#assertUsable();
    const staged = new Map<string, THREE.Object3D>();
    try {
      for (const chunk of allChunkCoords(this.#config)) {
        staged.set(chunkKey(chunk), this.#buildChunkObject(zones, chunk));
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

  rebuildDirty(zones: ZoneSnapshot, chunks: readonly ChunkCoord[]): void {
    this.#assertUsable();
    const replacements = new Map<string, THREE.Object3D>();
    try {
      for (const chunk of sortedChunks(chunks)) {
        const key = chunkKey(chunk);
        if (!this.#chunks.has(key)) throw new Error(`zone-presentation:missing-chunk:${key}`);
        replacements.set(key, this.#buildChunkObject(zones, chunk));
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
    if (object === undefined) throw new Error(`zone-presentation:missing-chunk:${chunkKey(chunk)}`);
    return object;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#scene.remove(this.#root);
    for (const object of this.#chunks.values()) disposeObject(object);
    this.#chunks.clear();
    this.#root.clear();
    disposeZoneMaterials(this.#materials);
  }

  #buildChunkObject(zones: ZoneSnapshot, chunk: ChunkCoord): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `zone-chunk:${chunkKey(chunk)}`;
    const data = this.#source.buildChunk(zones, chunk);
    if (data.positions.length > 0) {
      const mesh = new THREE.Mesh(createZoneGeometry(data), [...this.#materials.committed]);
      mesh.name = `zone-chunk-surface:${chunkKey(chunk)}`;
      group.add(mesh);
    }
    return group;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('zone-presentation:disposed');
  }
}
