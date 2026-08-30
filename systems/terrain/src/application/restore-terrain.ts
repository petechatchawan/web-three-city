import type { VertexCoord } from "@web-three-city/world";
import type {
  RestoreTerrainInput,
  TerrainConstructionResult,
} from "../contracts/terrain-composition";
import { parseLogicalElevation } from "../domain/elevation";
import {
  TERRAIN_FINGERPRINT_PATTERN,
  TERRAIN_GENERATION_PROFILE_ID,
  TERRAIN_GENERATION_PROFILE_VERSION,
  TERRAIN_SEED64_PATTERN,
} from "../domain/generation/profile";
import {
  restoreTerrainState,
  type CanonicalVertexRecord,
  type TerrainState,
} from "../domain/terrain-state";
import {
  TERRAIN_CHUNK_AXIS_COUNT,
  TERRAIN_LOGICAL_CHUNK_COUNT,
  TERRAIN_VERTEX_AXIS_COUNT,
  toChunkKey,
  toVertexKey,
} from "./world-index";

type RestoreFailureReason =
  | "snapshot-incompatible"
  | "snapshot-invalid"
  | "world-topology-rejected";

interface RestoreFailure {
  readonly reason: RestoreFailureReason;
  readonly issue: string;
}

type RestoreStepResult<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "rejected"; readonly failure: RestoreFailure };

function reject(
  reason: RestoreFailureReason,
  issue: string,
): TerrainConstructionResult<TerrainState> {
  return { status: "rejected", reason, detail: Object.freeze({ issue }) };
}

function failed<T>(
  reason: RestoreFailureReason,
  issue: string,
): RestoreStepResult<T> {
  return { status: "rejected", failure: { reason, issue } };
}

function validChunkAxis(value: number): boolean {
  return (
    Number.isInteger(value) && value >= 0 && value < TERRAIN_CHUNK_AXIS_COUNT
  );
}

function validateSnapshotHeader(
  input: RestoreTerrainInput,
): RestoreFailure | undefined {
  const snapshot = input.snapshot;
  if (
    snapshot.snapshotVersion !== 1 ||
    snapshot.mapDefinitionId !== input.mapDefinitionId ||
    snapshot.generationProfileId !== TERRAIN_GENERATION_PROFILE_ID ||
    snapshot.generationProfileVersion !== TERRAIN_GENERATION_PROFILE_VERSION
  ) {
    return { reason: "snapshot-incompatible", issue: "snapshot-identity" };
  }
  if (!TERRAIN_SEED64_PATTERN.test(snapshot.selectedSeed64)) {
    return { reason: "snapshot-invalid", issue: "seed64" };
  }
  if (!TERRAIN_FINGERPRINT_PATTERN.test(snapshot.fingerprint)) {
    return { reason: "snapshot-invalid", issue: "fingerprint" };
  }
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) {
    return { reason: "snapshot-invalid", issue: "revision" };
  }
  if (snapshot.completeness !== "full" && snapshot.completeness !== "partial") {
    return { reason: "snapshot-invalid", issue: "completeness" };
  }
  return undefined;
}

function validChunkCompleteness(
  completeness: RestoreTerrainInput["snapshot"]["completeness"],
  chunkCount: number,
): boolean {
  return completeness === "full"
    ? chunkCount === TERRAIN_LOGICAL_CHUNK_COUNT
    : chunkCount < TERRAIN_LOGICAL_CHUNK_COUNT;
}

function indexSnapshotChunks(
  snapshot: RestoreTerrainInput["snapshot"],
): RestoreStepResult<Map<number, readonly number[]>> {
  const chunks = new Map<number, readonly number[]>();
  let previousChunkKey = -1;
  for (const chunk of snapshot.chunks) {
    if (!validChunkAxis(chunk.chunk.x) || !validChunkAxis(chunk.chunk.z)) {
      return failed("snapshot-invalid", "chunk-coordinate");
    }
    const chunkKey = toChunkKey(chunk.chunk);
    if (chunkKey <= previousChunkKey || chunks.has(chunkKey)) {
      return failed("snapshot-invalid", "chunk-order-or-duplicate");
    }
    previousChunkKey = chunkKey;
    chunks.set(chunkKey, chunk.elevations);
  }
  return validChunkCompleteness(snapshot.completeness, chunks.size)
    ? { status: "success", value: chunks }
    : failed("snapshot-invalid", "chunk-completeness");
}

function consumeCanonicalRecords(
  input: RestoreTerrainInput,
  chunks: ReadonlyMap<number, readonly number[]>,
): RestoreStepResult<readonly CanonicalVertexRecord[]> {
  const cursors = new Map<number, number>();
  const records: CanonicalVertexRecord[] = [];
  for (let z = 0; z < TERRAIN_VERTEX_AXIS_COUNT; z += 1) {
    for (let x = 0; x < TERRAIN_VERTEX_AXIS_COUNT; x += 1) {
      const vertex: VertexCoord = { x, z };
      const owner = input.world.ownerChunk(vertex);
      if (owner.status !== "success") {
        return failed("world-topology-rejected", "owner-chunk");
      }
      const chunkKey = toChunkKey(owner.value);
      const elevations = chunks.get(chunkKey);
      if (elevations === undefined) continue;
      const cursor = cursors.get(chunkKey) ?? 0;
      const rawElevation = elevations[cursor];
      if (rawElevation === undefined) {
        return failed("snapshot-invalid", "chunk-elevation-count");
      }
      const elevation = parseLogicalElevation(rawElevation);
      if (elevation.status !== "success") {
        return failed("snapshot-invalid", "elevation");
      }
      records.push({
        chunkKey,
        vertexKey: toVertexKey(vertex),
        elevation: elevation.value,
      });
      cursors.set(chunkKey, cursor + 1);
    }
  }

  for (const [chunkKey, elevations] of chunks) {
    if ((cursors.get(chunkKey) ?? 0) !== elevations.length) {
      return failed("snapshot-invalid", "chunk-elevation-count");
    }
  }
  return { status: "success", value: records };
}

export function restoreTerrain(
  input: RestoreTerrainInput,
): TerrainConstructionResult<TerrainState> {
  const headerFailure = validateSnapshotHeader(input);
  if (headerFailure !== undefined) {
    return reject(headerFailure.reason, headerFailure.issue);
  }

  const indexedChunks = indexSnapshotChunks(input.snapshot);
  if (indexedChunks.status !== "success") {
    return reject(indexedChunks.failure.reason, indexedChunks.failure.issue);
  }

  const records = consumeCanonicalRecords(input, indexedChunks.value);
  if (records.status !== "success") {
    return reject(records.failure.reason, records.failure.issue);
  }

  const snapshot = input.snapshot;
  return {
    status: "success",
    value: restoreTerrainState({
      provenance: {
        mapDefinitionId: snapshot.mapDefinitionId,
        generationProfileId: snapshot.generationProfileId,
        generationProfileVersion: snapshot.generationProfileVersion,
        selectedSeed64: snapshot.selectedSeed64,
        fingerprint: snapshot.fingerprint,
      },
      records: records.value,
      loadedChunkKeys: [...indexedChunks.value.keys()],
      expectedChunkCount: TERRAIN_LOGICAL_CHUNK_COUNT,
      revision: snapshot.revision,
    }),
  };
}
