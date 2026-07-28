import {
  allChunkCoords,
  chunkCellBounds,
  type ChunkCoord,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { vertexToWorld, type WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';

const GRID_OFFSET = 0.015;

export interface TerrainGridChunkData {
  readonly chunk: ChunkCoord;
  readonly terrainRevision: number;
  readonly positions: Float32Array;
  readonly segmentCount: number;
}

function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.x}:${chunk.z}`;
}

function assertSnapshot(snapshot: TerrainSnapshot, config: WorldConfig): void {
  if (
    snapshot.width !== config.mapWidth ||
    snapshot.height !== config.mapHeight ||
    snapshot.heightLevels.length !== (config.mapWidth + 1) * (config.mapHeight + 1)
  ) {
    throw new Error('terrain-grid:invalid-snapshot');
  }
}

function heightAt(snapshot: TerrainSnapshot, x: number, z: number): number {
  return snapshot.heightLevels[z * (snapshot.width + 1) + x]!;
}

function appendVertex(
  positions: number[],
  snapshot: TerrainSnapshot,
  x: number,
  z: number,
  config: WorldConfig,
): void {
  const world = vertexToWorld({ x, z }, heightAt(snapshot, x, z), config);
  positions.push(world.x, world.y + GRID_OFFSET, world.z);
}

function appendSegment(
  positions: number[],
  snapshot: TerrainSnapshot,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  config: WorldConfig,
): void {
  appendVertex(positions, snapshot, fromX, fromZ, config);
  appendVertex(positions, snapshot, toX, toZ, config);
}

export function buildTerrainGridChunkData(
  snapshot: TerrainSnapshot,
  chunk: ChunkCoord,
  config: WorldConfig,
): TerrainGridChunkData {
  assertSnapshot(snapshot, config);
  const bounds = chunkCellBounds(chunk, config);
  const positions: number[] = [];

  for (let z = bounds.minCellZ; z <= bounds.maxCellZ; z += 1) {
    for (let x = bounds.minCellX; x <= bounds.maxCellX; x += 1) {
      // Every cell owns its east and south edge. Adjacent chunks therefore share
      // identical seam vertices without duplicating complete edge segments.
      appendSegment(positions, snapshot, x + 1, z, x + 1, z + 1, config);
      appendSegment(positions, snapshot, x, z + 1, x + 1, z + 1, config);

      if (z === 0) appendSegment(positions, snapshot, x, 0, x + 1, 0, config);
      if (x === 0) appendSegment(positions, snapshot, 0, z, 0, z + 1, config);
    }
  }

  return Object.freeze({
    chunk: Object.freeze({ ...chunk }),
    terrainRevision: snapshot.revision,
    positions: new Float32Array(positions),
    segmentCount: positions.length / 6,
  });
}

function createGeometry(data: TerrainGridChunkData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.LineSegments) object.geometry.dispose();
  });
}

export class TerrainGridPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #material = new THREE.LineBasicMaterial({
    color: 0x315f69,
    transparent: true,
    opacity: 0.24,
    depthTest: true,
    depthWrite: false,
  });
  #root: THREE.Group | null = null;
  #chunks = new Map<string, THREE.LineSegments>();
  #visible = true;
  #disposed = false;

  constructor(scene: THREE.Scene, config: WorldConfig) {
    this.#scene = scene;
    this.#config = config;
  }

  get object3d(): THREE.Group {
    this.#assertUsable();
    if (this.#root === null) throw new Error('terrain-grid:not-loaded');
    return this.#root;
  }

  get visible(): boolean {
    return this.#visible;
  }

  load(snapshot: TerrainSnapshot): void {
    this.#assertUsable();
    const stagedRoot = new THREE.Group();
    stagedRoot.name = 'terrain-grid-presentation-root';
    stagedRoot.visible = this.#visible;
    const stagedChunks = new Map<string, THREE.LineSegments>();

    try {
      for (const chunk of allChunkCoords(this.#config)) {
        const data = buildTerrainGridChunkData(snapshot, chunk, this.#config);
        const lines = new THREE.LineSegments(createGeometry(data), this.#material);
        lines.name = `terrain-grid-chunk:${chunkKey(chunk)}`;
        lines.renderOrder = 10;
        stagedRoot.add(lines);
        stagedChunks.set(chunkKey(chunk), lines);
      }
    } catch (error) {
      disposeRoot(stagedRoot);
      stagedRoot.clear();
      throw error;
    }

    const previousRoot = this.#root;
    this.#scene.add(stagedRoot);
    this.#root = stagedRoot;
    this.#chunks = stagedChunks;

    if (previousRoot !== null) {
      this.#scene.remove(previousRoot);
      disposeRoot(previousRoot);
      previousRoot.clear();
    }
  }

  rebuild(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]): void {
    this.#assertUsable();
    if (this.#root === null) throw new Error('terrain-grid:not-loaded');
    const replacements = new Map<string, THREE.LineSegments>();

    try {
      for (const chunk of chunks) {
        const data = buildTerrainGridChunkData(snapshot, chunk, this.#config);
        const lines = new THREE.LineSegments(createGeometry(data), this.#material);
        lines.name = `terrain-grid-chunk:${chunkKey(chunk)}`;
        lines.renderOrder = 10;
        replacements.set(chunkKey(chunk), lines);
      }
    } catch (error) {
      for (const replacement of replacements.values()) replacement.geometry.dispose();
      throw error;
    }

    for (const [key, replacement] of replacements) {
      const previous = this.#chunks.get(key);
      if (previous === undefined) {
        for (const created of replacements.values()) created.geometry.dispose();
        throw new Error(`terrain-grid:missing-chunk:${key}`);
      }
      const index = this.#root.children.indexOf(previous);
      this.#root.remove(previous);
      this.#root.add(replacement);
      const appendedIndex = this.#root.children.indexOf(replacement);
      this.#root.children.splice(appendedIndex, 1);
      this.#root.children.splice(index, 0, replacement);
      previous.geometry.dispose();
      this.#chunks.set(key, replacement);
    }
  }

  setVisible(visible: boolean): void {
    this.#assertUsable();
    this.#visible = visible;
    if (this.#root !== null) this.#root.visible = visible;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#root !== null) {
      this.#scene.remove(this.#root);
      disposeRoot(this.#root);
      this.#root.clear();
      this.#root = null;
    }
    this.#chunks.clear();
    this.#material.dispose();
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('terrain-grid:disposed');
  }
}
