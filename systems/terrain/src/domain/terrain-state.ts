import type { LogicalElevation } from "./elevation";

export interface CanonicalVertexRecord {
  readonly chunkKey: number;
  readonly vertexKey: number;
  readonly elevation: LogicalElevation;
}

export type TerrainChunkStore = ReadonlyMap<
  number,
  ReadonlyMap<number, LogicalElevation>
>;

export interface TerrainState {
  readonly revision: number;
  readonly expectedChunkCount: number;
  readonly loadedChunkKeys: ReadonlySet<number>;
  readonly chunks: TerrainChunkStore;
}

export interface CreateTerrainStateInput {
  readonly records: readonly CanonicalVertexRecord[];
  readonly loadedChunkKeys: readonly number[];
  readonly expectedChunkCount: number;
}

export type TerrainStateElevationResult =
  | { readonly status: "success"; readonly value: LogicalElevation }
  | { readonly status: "unavailable" };

export function createTerrainState(input: CreateTerrainStateInput): TerrainState {
  const loadedChunkKeys = new Set(input.loadedChunkKeys);
  const chunks = new Map<number, Map<number, LogicalElevation>>();

  for (const chunkKey of loadedChunkKeys) {
    chunks.set(chunkKey, new Map());
  }

  for (const record of input.records) {
    const chunk = chunks.get(record.chunkKey);
    if (chunk === undefined) {
      throw new Error(`Terrain record targets unloaded chunk ${record.chunkKey}`);
    }
    if (chunk.has(record.vertexKey)) {
      throw new Error(`Duplicate Terrain vertex key ${record.vertexKey}`);
    }
    chunk.set(record.vertexKey, record.elevation);
  }

  return {
    revision: 0,
    expectedChunkCount: input.expectedChunkCount,
    loadedChunkKeys,
    chunks,
  };
}

export function terrainCompleteness(state: TerrainState): "partial" | "full" {
  return state.loadedChunkKeys.size === state.expectedChunkCount
    ? "full"
    : "partial";
}

export function readTerrainElevation(
  state: TerrainState,
  chunkKey: number,
  vertexKey: number,
): TerrainStateElevationResult {
  if (!state.loadedChunkKeys.has(chunkKey)) {
    return { status: "unavailable" };
  }

  const elevation = state.chunks.get(chunkKey)?.get(vertexKey);
  return elevation === undefined
    ? { status: "unavailable" }
    : { status: "success", value: elevation };
}
