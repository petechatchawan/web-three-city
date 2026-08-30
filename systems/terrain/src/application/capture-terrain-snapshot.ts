import type {
  TerrainChunkSnapshot,
  TerrainStateSnapshotV1,
} from "../contracts/snapshot";
import {
  terrainCompleteness,
  type TerrainState,
} from "../domain/terrain-state";
import { TERRAIN_CHUNK_AXIS_COUNT } from "./world-index";

function chunkCoord(chunkKey: number) {
  return Object.freeze({
    x: chunkKey % TERRAIN_CHUNK_AXIS_COUNT,
    z: Math.floor(chunkKey / TERRAIN_CHUNK_AXIS_COUNT),
  });
}

export function captureTerrainSnapshot(
  state: TerrainState,
): TerrainStateSnapshotV1 {
  const chunks: TerrainChunkSnapshot[] = [...state.loadedChunkKeys]
    .sort((left, right) => left - right)
    .map((chunkKey) => {
      const elevations = [...(state.chunks.get(chunkKey)?.entries() ?? [])]
        .sort(([leftKey], [rightKey]) => leftKey - rightKey)
        .map(([, elevation]) => elevation);
      return Object.freeze({
        chunk: chunkCoord(chunkKey),
        elevations: Object.freeze(elevations),
      });
    });

  return Object.freeze({
    snapshotVersion: 1,
    ...state.provenance,
    revision: state.revision,
    completeness: terrainCompleteness(state),
    chunks: Object.freeze(chunks),
  });
}
