import type { MapStateSnapshot, RegionId } from "@web-three-city/world";
import type { TerrainStateSnapshotV1 } from "@web-three-city/terrain";
import {
  CITY_SAVE_SCHEMA_VERSION,
  parseCityId,
  parseCityName,
} from "./identity";
import type {
  CityMetadata,
  CitySaveDecodeResult,
  CitySaveSummary,
  CitySaveV1,
} from "./city-session";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function decodeMetadata(value: unknown): CityMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const cityId =
    typeof value.cityId === "string" ? parseCityId(value.cityId) : undefined;
  const name =
    typeof value.name === "string" ? parseCityName(value.name) : undefined;
  if (cityId?.status !== "success" || cityId.value !== value.cityId)
    return undefined;
  if (name?.status !== "success" || name.value !== value.name) return undefined;
  if (
    !isCanonicalIso(value.createdAt) ||
    !isCanonicalIso(value.updatedAt) ||
    !isCanonicalIso(value.lastPlayedAt)
  )
    return undefined;
  if (value.createdAt > value.updatedAt || value.createdAt > value.lastPlayedAt)
    return undefined;
  return Object.freeze({
    cityId: cityId.value,
    name: name.value,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastPlayedAt: value.lastPlayedAt,
  });
}

function looksLikeWorldSnapshot(value: unknown): value is MapStateSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.mapDefinitionId === "string" &&
    value.mapProfileId === "production-v1" &&
    value.mapProfileVersion === 1 &&
    typeof value.startingRegionId === "string" &&
    Array.isArray(value.unlockedRegionIds) &&
    value.unlockedRegionIds.every((region) => typeof region === "string")
  );
}

function looksLikeTerrainSnapshot(
  value: unknown,
): value is TerrainStateSnapshotV1 {
  if (!isRecord(value)) return false;
  return (
    value.snapshotVersion === 1 &&
    typeof value.mapDefinitionId === "string" &&
    typeof value.generationProfileId === "string" &&
    Number.isInteger(value.generationProfileVersion) &&
    typeof value.selectedSeed64 === "string" &&
    typeof value.fingerprint === "string" &&
    Number.isInteger(value.revision) &&
    typeof value.revision === "number" &&
    value.revision >= 0 &&
    (value.completeness === "full" || value.completeness === "partial") &&
    Array.isArray(value.chunks)
  );
}

export function decodeCitySaveV1(value: unknown): CitySaveDecodeResult {
  if (!isRecord(value) || value.schemaVersion !== CITY_SAVE_SCHEMA_VERSION) {
    return Object.freeze({
      status: "rejected",
      code: "CITY_SAVE_SCHEMA_UNSUPPORTED",
    });
  }
  const metadata = decodeMetadata(value.metadata);
  if (metadata === undefined) {
    return Object.freeze({
      status: "rejected",
      code: "CITY_SAVE_METADATA_INVALID",
    });
  }
  if (
    !looksLikeWorldSnapshot(value.worldSnapshot) ||
    !looksLikeTerrainSnapshot(value.terrainSnapshot)
  ) {
    return Object.freeze({
      status: "rejected",
      code: "CITY_SAVE_SNAPSHOT_INVALID",
    });
  }
  return Object.freeze({
    status: "success",
    value: Object.freeze({
      schemaVersion: CITY_SAVE_SCHEMA_VERSION,
      metadata,
      worldSnapshot: value.worldSnapshot,
      terrainSnapshot: value.terrainSnapshot,
    }),
  });
}

export function summarizeCitySave(save: CitySaveV1): CitySaveSummary {
  return Object.freeze({
    cityId: save.metadata.cityId,
    name: save.metadata.name,
    updatedAt: save.metadata.updatedAt,
    lastPlayedAt: save.metadata.lastPlayedAt,
    selectedSeed64: save.terrainSnapshot.selectedSeed64,
    fingerprint: save.terrainSnapshot.fingerprint,
    terrainRevision: save.terrainSnapshot.revision,
    startingRegionId: save.worldSnapshot.startingRegionId as RegionId,
  });
}
