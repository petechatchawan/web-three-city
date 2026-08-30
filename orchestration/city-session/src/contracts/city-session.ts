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
import type { TerrainCommands } from "@web-three-city/terrain/commands";
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
  readonly commands: TerrainCommands;
  readonly opaque: unknown;
  captureSnapshot(): TerrainStateSnapshotV1;
}

export interface LiveCitySession {
  readonly metadata: CityMetadata;
  readonly world: WorldSystem;
  readonly terrain: TerrainSessionHandle;
}

export type CitySaveDecodeResult =
  | { readonly status: "success"; readonly value: CitySaveV1 }
  | {
      readonly status: "rejected";
      readonly code:
        | "CITY_SAVE_SCHEMA_UNSUPPORTED"
        | "CITY_SAVE_METADATA_INVALID"
        | "CITY_SAVE_SNAPSHOT_INVALID";
    };

export type CitySessionFailureCode =
  | "CITY_NAME_REQUIRED"
  | "CITY_NAME_TOO_LONG"
  | "CITY_WORLD_PREPARE_FAILED"
  | "CITY_TERRAIN_PREPARE_FAILED"
  | "CITY_NO_ELIGIBLE_START"
  | "CITY_STARTING_REGION_NOT_ELIGIBLE"
  | "CITY_WORLD_CREATE_FAILED"
  | "CITY_TERRAIN_CREATE_FAILED"
  | "CITY_PERSISTENCE_FAILED"
  | "CITY_SAVE_NOT_FOUND"
  | "CITY_SAVE_INVALID"
  | "CITY_WORLD_RESTORE_FAILED"
  | "CITY_TERRAIN_RESTORE_FAILED";

export type CitySessionResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly code: CitySessionFailureCode;
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export type ResumeCityResult =
  | { readonly status: "empty" }
  | CitySessionResult<LiveCitySession>;

export interface CitySessionService {
  prepareNewCity(input: {
    readonly name: string;
    readonly seed64: string;
  }): CitySessionResult<NewCityPreview>;
  createNewCity(input: {
    readonly preview: NewCityPreview;
    readonly selectedStartingRegionId: RegionId;
  }): Promise<CitySessionResult<LiveCitySession>>;
  saveCity(
    session: LiveCitySession,
  ): Promise<CitySessionResult<LiveCitySession>>;
  loadCity(cityId: CityId): Promise<CitySessionResult<LiveCitySession>>;
  resumeCity(): Promise<ResumeCityResult>;
  listCities(): Promise<CitySessionResult<readonly CitySaveSummary[]>>;
}
