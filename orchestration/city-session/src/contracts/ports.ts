import type {
  MapStateSnapshot,
  PreparedWorldDefinition,
  RegionId,
  WorldSpatialRead,
  WorldSystem,
} from "@web-three-city/world";
import type { TerrainStateSnapshotV1 } from "@web-three-city/terrain";
import type { CityId } from "./identity";
import type {
  CitySaveSummary,
  CitySaveV1,
  PreparedTerrainHandle,
  TerrainSessionHandle,
} from "./city-session";

export type LifecyclePortResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly code: string;
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export interface WorldLifecyclePort {
  prepareDefinition(): LifecyclePortResult<PreparedWorldDefinition>;
  createInitial(input: {
    readonly prepared: PreparedWorldDefinition;
    readonly selectedStartingRegionId: RegionId;
    readonly eligibleStartingRegionIds: readonly RegionId[];
  }): LifecyclePortResult<WorldSystem>;
  restore(snapshot: MapStateSnapshot): LifecyclePortResult<WorldSystem>;
}

export interface TerrainLifecyclePort {
  prepare(
    world: PreparedWorldDefinition,
    seed64: string,
  ): LifecyclePortResult<PreparedTerrainHandle>;
  create(
    world: WorldSpatialRead,
    preparedTerrain: PreparedTerrainHandle,
  ): LifecyclePortResult<TerrainSessionHandle>;
  restore(
    world: WorldSpatialRead,
    snapshot: TerrainStateSnapshotV1,
  ): LifecyclePortResult<TerrainSessionHandle>;
}

export type CityRepositoryFailureCode =
  | "CITY_REPOSITORY_READ_FAILED"
  | "CITY_REPOSITORY_WRITE_FAILED"
  | "CITY_REPOSITORY_DELETE_FAILED"
  | "CITY_REPOSITORY_CORRUPT";

export type CityRepositoryResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "failure";
      readonly code: CityRepositoryFailureCode;
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export interface CitySaveRepository {
  list(): Promise<CityRepositoryResult<readonly CitySaveSummary[]>>;
  load(cityId: CityId): Promise<CityRepositoryResult<CitySaveV1 | undefined>>;
  latest(): Promise<CityRepositoryResult<CitySaveV1 | undefined>>;
  save(save: CitySaveV1): Promise<CityRepositoryResult<void>>;
  remove(cityId: CityId): Promise<CityRepositoryResult<void>>;
}

export interface Clock {
  nowIso(): string;
}

export interface IdSource {
  nextCityId(): CityId;
}

export interface CitySessionDependencies {
  readonly world: WorldLifecyclePort;
  readonly terrain: TerrainLifecyclePort;
  readonly repository: CitySaveRepository;
  readonly clock: Clock;
  readonly ids: IdSource;
}
