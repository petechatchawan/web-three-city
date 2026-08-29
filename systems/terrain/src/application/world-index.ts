import type { ChunkCoord, VertexCoord } from "@web-three-city/world";

export const TERRAIN_VERTEX_AXIS_COUNT = 513;
export const TERRAIN_CHUNK_AXIS_COUNT = 16;
export const TERRAIN_LOGICAL_CHUNK_COUNT =
  TERRAIN_CHUNK_AXIS_COUNT * TERRAIN_CHUNK_AXIS_COUNT;

export function toVertexKey(
  vertex: VertexCoord,
  vertexWidth = TERRAIN_VERTEX_AXIS_COUNT,
): number {
  return vertex.z * vertexWidth + vertex.x;
}

export function toChunkKey(chunk: ChunkCoord): number {
  return chunk.z * TERRAIN_CHUNK_AXIS_COUNT + chunk.x;
}
