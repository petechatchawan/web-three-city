import type {
  ChunkCoord,
  OuterSkirtMeshData,
  TerrainChunkMeshData,
  TerrainSnapshot,
} from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createChunkGeometry } from './chunk-geometry-adapter.js';
import { createTerrainMaterials } from './material-factory.js';
import { createOuterSkirtGeometry } from './outer-skirt-presentation.js';

export interface TerrainPresentationBuild {
  readonly chunks: readonly TerrainChunkMeshData[];
  readonly skirt: OuterSkirtMeshData;
}

export interface TerrainPresentationSource {
  buildAll(snapshot: TerrainSnapshot): TerrainPresentationBuild;
  buildChunks(
    snapshot: TerrainSnapshot,
    chunks: readonly ChunkCoord[],
  ): readonly TerrainChunkMeshData[];
}

function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.x}:${chunk.z}`;
}

function disposeGroupGeometry(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}

export class TerrainPresentation {
  readonly #scene: THREE.Scene;
  readonly #source: TerrainPresentationSource;
  readonly #config: WorldConfig;
  readonly #materials = createTerrainMaterials();
  #root: THREE.Group | null = null;
  #chunkMeshes = new Map<string, THREE.Mesh>();
  #disposed = false;

  constructor(scene: THREE.Scene, source: TerrainPresentationSource, config: WorldConfig) {
    this.#scene = scene;
    this.#source = source;
    this.#config = config;
  }

  load(snapshot: TerrainSnapshot): void {
    this.#assertUsable();
    this.#assertSnapshot(snapshot);
    const build = this.#source.buildAll(snapshot);
    const stagedRoot = new THREE.Group();
    stagedRoot.name = 'terrain-presentation-root';
    const stagedChunks = new Map<string, THREE.Mesh>();

    try {
      for (const chunk of build.chunks) {
        const mesh = new THREE.Mesh(createChunkGeometry(chunk), this.#materials.terrain);
        stagedRoot.add(mesh);
        stagedChunks.set(chunkKey(chunk.chunk), mesh);
      }
      stagedRoot.add(new THREE.Mesh(createOuterSkirtGeometry(build.skirt), this.#materials.skirt));
    } catch (error) {
      disposeGroupGeometry(stagedRoot);
      throw error;
    }

    const previousRoot = this.#root;
    this.#scene.add(stagedRoot);
    this.#root = stagedRoot;
    this.#chunkMeshes = stagedChunks;

    if (previousRoot !== null) {
      this.#scene.remove(previousRoot);
      disposeGroupGeometry(previousRoot);
      previousRoot.clear();
    }
  }

  rebuild(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]): void {
    this.#assertUsable();
    this.#assertSnapshot(snapshot);
    if (this.#root === null) throw new Error('terrain-presentation:not-loaded');

    const builds = this.#source.buildChunks(snapshot, chunks);
    const replacements = new Map<string, THREE.Mesh>();
    try {
      for (const build of builds) {
        replacements.set(
          chunkKey(build.chunk),
          new THREE.Mesh(createChunkGeometry(build), this.#materials.terrain),
        );
      }
    } catch (error) {
      for (const replacement of replacements.values()) replacement.geometry.dispose();
      throw error;
    }

    for (const [key, replacement] of replacements) {
      const previous = this.#chunkMeshes.get(key);
      if (previous === undefined) {
        for (const created of replacements.values()) created.geometry.dispose();
        throw new Error(`terrain-presentation:missing-chunk:${key}`);
      }
      this.#root.add(replacement);
      this.#root.remove(previous);
      previous.geometry.dispose();
      this.#chunkMeshes.set(key, replacement);
    }
  }

  getChunkMesh(chunk: ChunkCoord): THREE.Mesh {
    this.#assertUsable();
    const mesh = this.#chunkMeshes.get(chunkKey(chunk));
    if (mesh === undefined)
      throw new Error(`terrain-presentation:missing-chunk:${chunkKey(chunk)}`);
    return mesh;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#root !== null) {
      this.#scene.remove(this.#root);
      disposeGroupGeometry(this.#root);
      this.#root.clear();
      this.#root = null;
    }
    this.#chunkMeshes.clear();
    this.#materials.terrain.dispose();
    this.#materials.skirt.dispose();
  }

  #assertSnapshot(snapshot: TerrainSnapshot): void {
    if (snapshot.width !== this.#config.mapWidth || snapshot.height !== this.#config.mapHeight) {
      throw new Error('terrain-presentation:invalid-snapshot-dimensions');
    }
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('terrain-presentation:disposed');
  }
}
