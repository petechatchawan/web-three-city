import type { WorldPoint } from '@web-three-city/world-core';
import type { ChunkCoord } from './chunking.js';

export interface MeshBounds {
  readonly min: WorldPoint;
  readonly max: WorldPoint;
}

export interface TerrainChunkMeshData {
  readonly chunk: ChunkCoord;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly bounds: MeshBounds;
}

export interface OuterSkirtMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly segmentCount: number;
  readonly bounds: MeshBounds;
}
