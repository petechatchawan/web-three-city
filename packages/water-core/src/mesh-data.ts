import type { ChunkCoord, MeshBounds } from '@web-three-city/terrain-core';

export interface WaterChunkMeshData {
  readonly chunk: ChunkCoord;
  readonly sourceTerrainRevision: number;
  readonly surfacePositions: Float32Array;
  readonly surfaceNormals: Float32Array;
  readonly surfaceColors: Float32Array;
  readonly surfaceIndices: Uint16Array;
  readonly shorelinePositions: Float32Array;
  readonly shorelineColors: Float32Array;
  readonly shorelineIndices: Uint16Array;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly bounds: MeshBounds;
}

export interface WaterWallMeshData {
  readonly sourceTerrainRevision: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly segmentCount: number;
  readonly bounds: MeshBounds;
}
