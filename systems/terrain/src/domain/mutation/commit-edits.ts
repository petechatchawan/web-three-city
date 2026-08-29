import type { LogicalElevation } from "../elevation";
import type { TerrainState } from "../terrain-state";

export interface CanonicalElevationUpdate {
  readonly chunkKey: number;
  readonly vertexKey: number;
  readonly elevation: LogicalElevation;
}

export function commitCanonicalUpdates(
  state: TerrainState,
  updates: readonly CanonicalElevationUpdate[],
): TerrainState {
  if (updates.length === 0) return state;

  const chunks = new Map(state.chunks);
  const writableChunks = new Map<number, Map<number, LogicalElevation>>();

  for (const update of updates) {
    let writable = writableChunks.get(update.chunkKey);
    if (writable === undefined) {
      const current = state.chunks.get(update.chunkKey);
      if (current === undefined) {
        throw new Error(
          `Cannot mutate unavailable Terrain chunk ${update.chunkKey}`,
        );
      }
      writable = new Map(current);
      writableChunks.set(update.chunkKey, writable);
      chunks.set(update.chunkKey, writable);
    }
    writable.set(update.vertexKey, update.elevation);
  }

  return {
    provenance: state.provenance,
    revision: state.revision + 1,
    expectedChunkCount: state.expectedChunkCount,
    loadedChunkKeys: state.loadedChunkKeys,
    chunks,
  };
}
