import type { CommandResult } from "@web-three-city/foundation-contracts";
import type { CellCoord, ChunkCoord, VertexCoord } from "@web-three-city/world";
import type { LogicalElevation } from "../domain/elevation";

export interface TerrainVertexEdit {
  readonly vertex: VertexCoord;
  readonly elevation: LogicalElevation;
}

export interface ApplyTerrainEdits {
  readonly edits: readonly TerrainVertexEdit[];
}

export interface TerrainChangeSet {
  readonly previousRevision: number;
  readonly newRevision: number;
  readonly changedVertices: readonly VertexCoord[];
  readonly affectedCells: readonly CellCoord[];
  readonly touchingLogicalChunks: readonly ChunkCoord[];
}

export interface TerrainMutationReceipt {
  readonly changed: boolean;
  readonly previousRevision: number;
  readonly newRevision: number;
  readonly changeSet: TerrainChangeSet;
}

export type TerrainMutationRejectionCode =
  | "TERRAIN_MUTATION_DUPLICATE_VERTEX"
  | "TERRAIN_MUTATION_VERTEX_OUT_OF_BOUNDS"
  | "TERRAIN_MUTATION_CHUNK_UNAVAILABLE"
  | "TERRAIN_MUTATION_ELEVATION_INVALID"
  | "TERRAIN_MUTATION_ELEVATION_OUT_OF_RANGE";

export interface TerrainMutationRejection {
  readonly code: TerrainMutationRejectionCode;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface TerrainCommands {
  applyEdits(
    command: ApplyTerrainEdits,
  ): CommandResult<TerrainMutationReceipt, TerrainMutationRejection>;
}
