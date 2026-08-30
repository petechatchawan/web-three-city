import type { ChunkCoord } from "@web-three-city/world";
import type { LogicalElevation } from "../domain/elevation";
import type { TerrainCompleteness } from "./terrain-read";

export interface TerrainChunkSnapshot {
  readonly chunk: ChunkCoord;
  readonly elevations: readonly LogicalElevation[];
}

export interface TerrainStateSnapshotV1 {
  readonly snapshotVersion: 1;
  readonly mapDefinitionId: string;
  readonly generationProfileId: string;
  readonly generationProfileVersion: number;
  readonly selectedSeed64: string;
  readonly fingerprint: string;
  readonly revision: number;
  readonly completeness: TerrainCompleteness;
  readonly chunks: readonly TerrainChunkSnapshot[];
}
