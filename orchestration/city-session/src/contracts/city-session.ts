import type {
  MapStateSnapshot,
  PreparedWorldDefinition,
  RegionId,
  WorldSystem,
} from "@web-three-city/world";
import type {
  TerrainAuthorityRead,
  TerrainStateSnapshotV1,
} from "@web-three-city/terrain";
import type { CityId, CityName } from "./identity";

export interface CityMetadata {
  readonly cityId: CityId;
  readonly name: CityName;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastPlayedAt: string;
}

export interface CitySaveV1 {
  readonly schemaVersion: 1;
  readonly metadata: CityMetadata;
  readonly worldSnapshot: MapStateSnapshot;
  readonly terrainSnapshot: TerrainStateSnapshotV1;
}

export interface CitySaveSummary {
  readonly cityId: CityId;
  readonly name: CityName;
  readonly updatedAt: string;
  readonly lastPlayedAt: string;
  readonly selectedSeed64: string;
  readonly fingerprint: string;
  readonly terrainRevision: number;
  readonly startingRegionId: RegionId;
}

export interface PreparedTerrainHandle {
  readonly selectedSeed64: string;
  readonly fingerprint: string;
  readonly eligibleStartingRegionIds: readonly RegionId[];
  readonly opaque: unknown;
}

export interface NewCityPreview {
  readonly name: CityName;
  readonly seed64: string;
  readonly fingerprint: string;
  readonly eligibleStartingRegionIds: readonly RegionId[];
  readonly preparedWorld: PreparedWorldDefinition;
  readonly preparedTerrain: PreparedTerrainHandle;
}

export interface TerrainSessionHandle {
  readonly read: TerrainAuthorityRead;
  readonly opaque: unknown;
  captureSnapshot(): TerrainStateSnapshotV1;
}

export interface LiveCitySession {
  readonly metadata: CityMetadata;
  readonly world: WorldSystem;
  readonly terrain: TerrainSessionHandle;
}
