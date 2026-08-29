import type { CommandResult } from "@web-three-city/foundation-contracts";
import type {
  CellCoord,
  ChunkCoord,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import type {
  ApplyTerrainEdits,
  TerrainMutationReceipt,
  TerrainMutationRejection,
  TerrainMutationRejectionCode,
} from "../contracts/mutation";
import {
  parseLogicalElevation,
  type LogicalElevation,
} from "../domain/elevation";
import {
  commitCanonicalUpdates,
  type CanonicalElevationUpdate,
} from "../domain/mutation/commit-edits";
import {
  readTerrainElevation,
  type TerrainState,
} from "../domain/terrain-state";
import { toChunkKey, toVertexKey } from "./world-index";

export interface ApplyTerrainEditsInput {
  readonly state: TerrainState;
  readonly world: WorldSpatialRead;
  readonly command: ApplyTerrainEdits;
}

export interface ApplyTerrainEditsOutcome {
  readonly state: TerrainState;
  readonly result: CommandResult<
    TerrainMutationReceipt,
    TerrainMutationRejection
  >;
}

interface OwnedEdit {
  readonly vertex: VertexCoord;
  readonly requestedElevation: number;
  readonly chunk: ChunkCoord;
  readonly chunkKey: number;
  readonly vertexKey: number;
  readonly currentElevation: LogicalElevation;
}

interface ValidatedEdit extends OwnedEdit {
  readonly elevation: LogicalElevation;
}

function compareNumber(left: number, right: number): number {
  if (left === right || Object.is(left, right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  return left < right ? -1 : 1;
}

function compareZX<T extends { readonly x: number; readonly z: number }>(
  left: T,
  right: T,
): number {
  return compareNumber(left.z, right.z) || compareNumber(left.x, right.x);
}

function coordinateKey(coord: {
  readonly x: number;
  readonly z: number;
}): string {
  return `${coord.z}:${coord.x}`;
}

function immutableCoord<T extends { readonly x: number; readonly z: number }>(
  coord: T,
): T {
  return Object.freeze({ x: coord.x, z: coord.z }) as T;
}

function rejected(
  state: TerrainState,
  code: TerrainMutationRejectionCode,
  message: string,
  detail?: Readonly<Record<string, unknown>>,
): ApplyTerrainEditsOutcome {
  return {
    state,
    result: {
      status: "rejected",
      rejection: {
        code,
        message,
        ...(detail === undefined ? {} : { detail: Object.freeze(detail) }),
      },
    },
  };
}

function noOp(state: TerrainState): ApplyTerrainEditsOutcome {
  const revision = state.revision;
  const changeSet = Object.freeze({
    previousRevision: revision,
    newRevision: revision,
    changedVertices: Object.freeze([]) as readonly VertexCoord[],
    affectedCells: Object.freeze([]) as readonly CellCoord[],
    touchingLogicalChunks: Object.freeze([]) as readonly ChunkCoord[],
  });

  return {
    state,
    result: {
      status: "success",
      value: Object.freeze({
        changed: false,
        previousRevision: revision,
        newRevision: revision,
        changeSet,
      }),
    },
  };
}

function collectTopology(
  world: WorldSpatialRead,
  changedVertices: readonly VertexCoord[],
): {
  readonly affectedCells: readonly CellCoord[];
  readonly touchingLogicalChunks: readonly ChunkCoord[];
} {
  const cells = new Map<string, CellCoord>();
  const chunks = new Map<string, ChunkCoord>();

  for (const vertex of changedVertices) {
    const incident = world.incidentCells(vertex);
    if (incident.status !== "success") {
      throw new Error(
        `World rejected incidentCells for validated Terrain vertex (${vertex.x},${vertex.z})`,
      );
    }
    for (const cell of incident.value) {
      cells.set(coordinateKey(cell), immutableCoord(cell));
    }

    const touching = world.touchingChunks(vertex);
    if (touching.status !== "success") {
      throw new Error(
        `World rejected touchingChunks for validated Terrain vertex (${vertex.x},${vertex.z})`,
      );
    }
    for (const chunk of touching.value) {
      chunks.set(coordinateKey(chunk), immutableCoord(chunk));
    }
  }

  return {
    affectedCells: Object.freeze([...cells.values()].sort(compareZX)),
    touchingLogicalChunks: Object.freeze([...chunks.values()].sort(compareZX)),
  };
}

export function applyTerrainEdits(
  input: ApplyTerrainEditsInput,
): ApplyTerrainEditsOutcome {
  const seen = new Set<string>();
  for (const edit of input.command.edits) {
    const key = coordinateKey(edit.vertex);
    if (seen.has(key)) {
      return rejected(
        input.state,
        "TERRAIN_MUTATION_DUPLICATE_VERTEX",
        "Terrain mutation contains a duplicate VertexCoord.",
        { vertex: immutableCoord(edit.vertex) },
      );
    }
    seen.add(key);
  }

  const normalized = [...input.command.edits].sort((left, right) =>
    compareZX(left.vertex, right.vertex),
  );

  const owned: Omit<OwnedEdit, "currentElevation">[] = [];
  for (const edit of normalized) {
    const owner = input.world.ownerChunk(edit.vertex);
    if (owner.status !== "success") {
      return rejected(
        input.state,
        "TERRAIN_MUTATION_VERTEX_OUT_OF_BOUNDS",
        "Terrain mutation targets a VertexCoord outside the map.",
        { vertex: immutableCoord(edit.vertex) },
      );
    }

    owned.push({
      vertex: immutableCoord(edit.vertex),
      requestedElevation: edit.elevation,
      chunk: immutableCoord(owner.value),
      chunkKey: toChunkKey(owner.value),
      vertexKey: toVertexKey(edit.vertex),
    });
  }

  const available: OwnedEdit[] = [];
  for (const edit of owned) {
    if (!input.state.loadedChunkKeys.has(edit.chunkKey)) {
      return rejected(
        input.state,
        "TERRAIN_MUTATION_CHUNK_UNAVAILABLE",
        "Terrain mutation targets an unavailable owner Chunk.",
        { vertex: edit.vertex, chunk: edit.chunk },
      );
    }

    const current = readTerrainElevation(
      input.state,
      edit.chunkKey,
      edit.vertexKey,
    );
    if (current.status !== "success") {
      return rejected(
        input.state,
        "TERRAIN_MUTATION_CHUNK_UNAVAILABLE",
        "Terrain mutation targets unavailable canonical Terrain authority.",
        { vertex: edit.vertex, chunk: edit.chunk },
      );
    }

    available.push({ ...edit, currentElevation: current.value });
  }

  const validated: ValidatedEdit[] = [];
  for (const edit of available) {
    const parsed = parseLogicalElevation(edit.requestedElevation);
    if (parsed.status === "rejected") {
      const code: TerrainMutationRejectionCode =
        parsed.code === "TERRAIN_ELEVATION_INVALID"
          ? "TERRAIN_MUTATION_ELEVATION_INVALID"
          : "TERRAIN_MUTATION_ELEVATION_OUT_OF_RANGE";
      return rejected(
        input.state,
        code,
        "Terrain mutation contains an invalid LogicalElevation.",
        { vertex: edit.vertex, value: edit.requestedElevation },
      );
    }

    validated.push({ ...edit, elevation: parsed.value });
  }

  const actual = validated.filter(
    (edit) => edit.currentElevation !== edit.elevation,
  );
  if (actual.length === 0) return noOp(input.state);

  const changedVertices = Object.freeze(
    actual.map((edit) => immutableCoord(edit.vertex)),
  );
  const topology = collectTopology(input.world, changedVertices);
  const updates: readonly CanonicalElevationUpdate[] = actual.map((edit) => ({
    chunkKey: edit.chunkKey,
    vertexKey: edit.vertexKey,
    elevation: edit.elevation,
  }));

  const nextState = commitCanonicalUpdates(input.state, updates);
  const changeSet = Object.freeze({
    previousRevision: input.state.revision,
    newRevision: nextState.revision,
    changedVertices,
    affectedCells: topology.affectedCells,
    touchingLogicalChunks: topology.touchingLogicalChunks,
  });

  return {
    state: nextState,
    result: {
      status: "success",
      value: Object.freeze({
        changed: true,
        previousRevision: input.state.revision,
        newRevision: nextState.revision,
        changeSet,
      }),
    },
  };
}
