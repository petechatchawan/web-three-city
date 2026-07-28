import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import {
  WaterContractError,
  type WaterChunkMeshData,
  type WaterSnapshot,
  type WaterWallMeshData,
} from '@web-three-city/water-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import {
  createWaterShorelineGeometry,
  createWaterSurfaceGeometry,
  createWaterWallGeometry,
} from './geometry-adapter.js';
import { createWaterMaterials } from './material-factory.js';

export interface WaterPresentationBuild {
  readonly chunks: readonly WaterChunkMeshData[];
  readonly wall: WaterWallMeshData;
}

export interface WaterPresentationSource {
  buildAll(terrain: TerrainSnapshot, water: WaterSnapshot): WaterPresentationBuild;
}

function disposeRootGeometry(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}

function chunkKey(chunk: Readonly<{ x: number; z: number }>): string {
  return `${chunk.x}:${chunk.z}`;
}

export class WaterPresentation {
  readonly #scene: THREE.Scene;
  readonly #source: WaterPresentationSource;
  readonly #config: WorldConfig;
  readonly #materials = createWaterMaterials();
  #root: THREE.Group | null = null;
  #disposed = false;

  constructor(scene: THREE.Scene, source: WaterPresentationSource, config: WorldConfig) {
    this.#scene = scene;
    this.#source = source;
    this.#config = config;
  }

  get object3d(): THREE.Group {
    this.#assertUsable();
    if (this.#root === null) throw new WaterContractError({ code: 'water:not-loaded' });
    return this.#root;
  }

  load(terrain: TerrainSnapshot, water: WaterSnapshot): void {
    this.#assertUsable();
    this.#assertCompatible(terrain, water);
    const build = this.#source.buildAll(terrain, water);
    const stagedRoot = new THREE.Group();
    stagedRoot.name = 'water-presentation-root';

    try {
      for (const chunk of build.chunks) {
        if (chunk.sourceTerrainRevision !== terrain.revision) {
          throw new WaterContractError({ code: 'water:terrain-revision-mismatch' });
        }
        const key = chunkKey(chunk.chunk);
        if (chunk.surfaceIndices.length > 0) {
          const surface = new THREE.Mesh(
            createWaterSurfaceGeometry(chunk),
            this.#materials.surface,
          );
          surface.name = `water-surface-chunk:${key}`;
          surface.renderOrder = 5;
          stagedRoot.add(surface);
        }
        if (chunk.shorelineIndices.length > 0) {
          const shoreline = new THREE.Mesh(
            createWaterShorelineGeometry(chunk),
            this.#materials.shoreline,
          );
          shoreline.name = `water-shoreline-chunk:${key}`;
          shoreline.renderOrder = 6;
          stagedRoot.add(shoreline);
        }
      }
      if (build.wall.sourceTerrainRevision !== terrain.revision) {
        throw new WaterContractError({ code: 'water:terrain-revision-mismatch' });
      }
      if (build.wall.indices.length > 0) {
        const wall = new THREE.Mesh(createWaterWallGeometry(build.wall), this.#materials.wall);
        wall.name = 'water-wall';
        wall.renderOrder = 4;
        stagedRoot.add(wall);
      }
    } catch (error) {
      disposeRootGeometry(stagedRoot);
      stagedRoot.clear();
      throw error;
    }

    const previousRoot = this.#root;
    this.#scene.add(stagedRoot);
    this.#root = stagedRoot;
    if (previousRoot !== null) {
      this.#scene.remove(previousRoot);
      disposeRootGeometry(previousRoot);
      previousRoot.clear();
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#root !== null) {
      this.#scene.remove(this.#root);
      disposeRootGeometry(this.#root);
      this.#root.clear();
      this.#root = null;
    }
    this.#materials.surface.dispose();
    this.#materials.shoreline.dispose();
    this.#materials.wall.dispose();
  }

  #assertCompatible(terrain: TerrainSnapshot, water: WaterSnapshot): void {
    if (
      terrain.width !== this.#config.mapWidth ||
      terrain.height !== this.#config.mapHeight ||
      water.width !== this.#config.mapWidth ||
      water.height !== this.#config.mapHeight ||
      terrain.revision !== water.sourceTerrainRevision ||
      water.seaLevel !== this.#config.seaLevel
    ) {
      throw new WaterContractError({ code: 'water:terrain-revision-mismatch' });
    }
  }

  #assertUsable(): void {
    if (this.#disposed) throw new WaterContractError({ code: 'water:disposed' });
  }
}
