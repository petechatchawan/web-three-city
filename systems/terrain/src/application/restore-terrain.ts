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

function reject(
  reason:
    | "snapshot-incompatible"
    | "snapshot-invalid"
    | "world-topology-rejected",
  issue: string,
): TerrainConstructionResult<TerrainState> {
  return { status: "rejected", reason, detail: Object.freeze({ issue }) };
}

function validChunkAxis(value: number): boolean {
  return (
    Number.isInteger(value) && value >= 0 && value < TERRAIN_CHUNK_AXIS_COUNT
  );
}

export function restoreTerrain(
  input: RestoreTerrainInput,
): TerrainConstructionResult<TerrainState> {
  const snapshot = input.snapshot;
  if (
    snapshot.snapshotVersion !== 1 ||
    snapshot.mapDefinitionId !== input.mapDefinitionId ||
    snapshot.generationProfileId !== TERRAIN_GENERATION_PROFILE_ID ||
    snapshot.generationProfileVersion !== TERRAIN_GENERATION_PROFILE_VERSION
  ) {
    return reject("snapshot-incompatible", "snapshot-identity");
  }
  if (!TERRAIN_SEED64_PATTERN.test(snapshot.selectedSeed64)) {
    return reject("snapshot-invalid", "seed64");
  }
  if (!TERRAIN_FINGERPRINT_PATTERN.test(snapshot.fingerprint)) {
    return reject("snapshot-invalid", "fingerprint");
  }
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) {
    return reject("snapshot-invalid", "revision");
  }
  if (snapshot.completeness !== "full" && snapshot.completeness !== "partial") {
    return reject("snapshot-invalid", "completeness");
  }

  const chunks = new Map<number, readonly number[]>();
  let previousChunkKey = -1;
  for (const chunk of snapshot.chunks) {
    if (!validChunkAxis(chunk.chunk.x) || !validChunkAxis(chunk.chunk.z)) {
      return reject("snapshot-invalid", "chunk-coordinate");
    }
    const chunkKey = toChunkKey(chunk.chunk);
    if (chunkKey <= previousChunkKey || chunks.has(chunkKey)) {
      return reject("snapshot-invalid", "chunk-order-or-duplicate");
    }
    previousChunkKey = chunkKey;
    chunks.set(chunkKey, chunk.elevations);
  }

  if (
    (snapshot.completeness === "full" &&
      chunks.size !== TERRAIN_LOGICAL_CHUNK_COUNT) ||
    (snapshot.completeness === "partial" &&
      chunks.size >= TERRAIN_LOGICAL_CHUNK_COUNT)
  ) {
    return reject("snapshot-invalid", "chunk-completeness");
  }

  const cursors = new Map<number, number>();
  const records: CanonicalVertexRecord[] = [];
  for (let z = 0; z < TERRAIN_VERTEX_AXIS_COUNT; z += 1) {
    for (let x = 0; x < TERRAIN_VERTEX_AXIS_COUNT; x += 1) {
      const vertex: VertexCoord = { x, z };
      const owner = input.world.ownerChunk(vertex);
      if (owner.status !== "success") {
        return reject("world-topology-rejected", "owner-chunk");
      }
      const chunkKey = toChunkKey(owner.value);
      const elevations = chunks.get(chunkKey);
      if (elevations === undefined) continue;
      const cursor = cursors.get(chunkKey) ?? 0;
      const rawElevation = elevations[cursor];
      if (rawElevation === undefined) {
        return reject("snapshot-invalid", "chunk-elevation-count");
      }
      const elevation = parseLogicalElevation(rawElevation);
      if (elevation.status !== "success") {
        return reject("snapshot-invalid", "elevation");
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
      return reject("snapshot-invalid", "chunk-elevation-count");
    }
  }

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
      records,
      loadedChunkKeys: [...chunks.keys()],
      expectedChunkCount: TERRAIN_LOGICAL_CHUNK_COUNT,
      revision: snapshot.revision,
    }),
  };
}
