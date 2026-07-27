import {
  allChunkCoords,
  buildCanonicalNormals,
  buildOuterSkirtMesh,
  buildTerrainChunkMesh,
} from '@web-three-city/terrain-core';
import type { ChunkCoord, TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import type { TerrainPresentationSource } from './terrain-presentation.js';

export function createCoreTerrainPresentationSource(
  config: WorldConfig,
): TerrainPresentationSource {
  return {
    buildAll(snapshot: TerrainSnapshot) {
      const normals = buildCanonicalNormals(snapshot, config);
      return {
        chunks: allChunkCoords(config).map((chunk) =>
          buildTerrainChunkMesh(snapshot, normals, chunk, config),
        ),
        skirt: buildOuterSkirtMesh(snapshot, config),
      };
    },
    buildChunks(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]) {
      const normals = buildCanonicalNormals(snapshot, config);
      return chunks.map((chunk) => buildTerrainChunkMesh(snapshot, normals, chunk, config));
    },
  };
}
