import { CITY_SAVE_SCHEMA_VERSION, parseCityName } from "../contracts/identity";
import { decodeCitySaveV1 } from "../contracts/save-codec";
import type {
  CityMetadata,
  CitySaveSummary,
  CitySaveV1,
  CitySessionResult,
  CitySessionService,
  LiveCitySession,
  NewCityPreview,
  ResumeCityResult,
} from "../contracts/city-session";
import type { CitySessionDependencies } from "../contracts/ports";

function rejected<T>(
  code: Exclude<CitySessionResult<T>, { status: "success" }>["code"],
  detail?: Readonly<Record<string, unknown>>,
): CitySessionResult<T> {
  return detail === undefined
    ? Object.freeze({ status: "rejected", code })
    : Object.freeze({ status: "rejected", code, detail });
}

function success<T>(value: T): CitySessionResult<T> {
  return Object.freeze({ status: "success", value });
}

function freezeMetadata(metadata: CityMetadata): CityMetadata {
  return Object.freeze({ ...metadata });
}

function createSave(
  metadata: CityMetadata,
  session: Pick<LiveCitySession, "world" | "terrain">,
): CitySaveV1 {
  return Object.freeze({
    schemaVersion: CITY_SAVE_SCHEMA_VERSION,
    metadata: freezeMetadata(metadata),
    worldSnapshot: session.world.captureSnapshot(),
    terrainSnapshot: session.terrain.captureSnapshot(),
  });
}

function createLiveSession(
  metadata: CityMetadata,
  world: LiveCitySession["world"],
  terrain: LiveCitySession["terrain"],
): LiveCitySession {
  return Object.freeze({ metadata: freezeMetadata(metadata), world, terrain });
}

function compareSummaries(
  left: CitySaveSummary,
  right: CitySaveSummary,
): number {
  return (
    right.lastPlayedAt.localeCompare(left.lastPlayedAt) ||
    left.cityId.localeCompare(right.cityId)
  );
}

export function createCitySessionServiceInternal(
  dependencies: CitySessionDependencies,
): CitySessionService {
  const restoreSave = async (
    raw: unknown,
  ): Promise<CitySessionResult<LiveCitySession>> => {
    const decoded = decodeCitySaveV1(raw);
    if (decoded.status !== "success") {
      return rejected("CITY_SAVE_INVALID", { ownerCode: decoded.code });
    }
    const save = decoded.value;
    const world = dependencies.world.restore(save.worldSnapshot);
    if (world.status !== "success") {
      return rejected("CITY_WORLD_RESTORE_FAILED", { ownerCode: world.code });
    }
    const terrain = dependencies.terrain.restore(
      world.value.spatial,
      save.terrainSnapshot,
    );
    if (terrain.status !== "success") {
      return rejected("CITY_TERRAIN_RESTORE_FAILED", {
        ownerCode: terrain.code,
      });
    }
    const lastPlayedAt = dependencies.clock.nowIso();
    const metadata = freezeMetadata({ ...save.metadata, lastPlayedAt });
    const live = createLiveSession(metadata, world.value, terrain.value);
    const durable = Object.freeze({ ...save, metadata });
    const persisted = await dependencies.repository.save(durable);
    if (persisted.status !== "success") {
      return rejected("CITY_PERSISTENCE_FAILED", { ownerCode: persisted.code });
    }
    return success(live);
  };

  const service: CitySessionService = {
    prepareNewCity(input) {
      const name = parseCityName(input.name);
      if (name.status !== "success") return rejected(name.code);
      const world = dependencies.world.prepareDefinition();
      if (world.status !== "success") {
        return rejected("CITY_WORLD_PREPARE_FAILED", { ownerCode: world.code });
      }
      const terrain = dependencies.terrain.prepare(world.value, input.seed64);
      if (terrain.status !== "success") {
        return rejected("CITY_TERRAIN_PREPARE_FAILED", {
          ownerCode: terrain.code,
        });
      }
      const eligible = Object.freeze([
        ...terrain.value.eligibleStartingRegionIds,
      ]);
      if (eligible.length === 0) return rejected("CITY_NO_ELIGIBLE_START");
      const preview: NewCityPreview = Object.freeze({
        name: name.value,
        seed64: terrain.value.selectedSeed64,
        fingerprint: terrain.value.fingerprint,
        eligibleStartingRegionIds: eligible,
        preparedWorld: world.value,
        preparedTerrain: terrain.value,
      });
      return success(preview);
    },

    async createNewCity(input) {
      if (
        !input.preview.eligibleStartingRegionIds.includes(
          input.selectedStartingRegionId,
        )
      ) {
        return rejected("CITY_STARTING_REGION_NOT_ELIGIBLE");
      }
      const world = dependencies.world.createInitial({
        prepared: input.preview.preparedWorld,
        selectedStartingRegionId: input.selectedStartingRegionId,
        eligibleStartingRegionIds: input.preview.eligibleStartingRegionIds,
      });
      if (world.status !== "success") {
        return rejected("CITY_WORLD_CREATE_FAILED", { ownerCode: world.code });
      }
      const terrain = dependencies.terrain.create(
        world.value.spatial,
        input.preview.preparedTerrain,
      );
      if (terrain.status !== "success") {
        return rejected("CITY_TERRAIN_CREATE_FAILED", {
          ownerCode: terrain.code,
        });
      }
      const now = dependencies.clock.nowIso();
      const metadata = freezeMetadata({
        cityId: dependencies.ids.nextCityId(),
        name: input.preview.name,
        createdAt: now,
        updatedAt: now,
        lastPlayedAt: now,
      });
      const live = createLiveSession(metadata, world.value, terrain.value);
      const persisted = await dependencies.repository.save(
        createSave(metadata, live),
      );
      if (persisted.status !== "success") {
        return rejected("CITY_PERSISTENCE_FAILED", {
          ownerCode: persisted.code,
        });
      }
      return success(live);
    },

    async saveCity(session) {
      const now = dependencies.clock.nowIso();
      const metadata = freezeMetadata({
        ...session.metadata,
        updatedAt: now,
        lastPlayedAt: now,
      });
      const updated = createLiveSession(
        metadata,
        session.world,
        session.terrain,
      );
      const persisted = await dependencies.repository.save(
        createSave(metadata, updated),
      );
      if (persisted.status !== "success") {
        return rejected("CITY_PERSISTENCE_FAILED", {
          ownerCode: persisted.code,
        });
      }
      return success(updated);
    },

    async loadCity(cityId) {
      const loaded = await dependencies.repository.load(cityId);
      if (loaded.status !== "success") {
        return rejected("CITY_PERSISTENCE_FAILED", { ownerCode: loaded.code });
      }
      if (loaded.value === undefined) return rejected("CITY_SAVE_NOT_FOUND");
      return restoreSave(loaded.value);
    },

    async resumeCity(): Promise<ResumeCityResult> {
      const latest = await dependencies.repository.latest();
      if (latest.status !== "success") {
        return rejected("CITY_PERSISTENCE_FAILED", { ownerCode: latest.code });
      }
      if (latest.value === undefined) return Object.freeze({ status: "empty" });
      return restoreSave(latest.value);
    },

    async listCities() {
      const listed = await dependencies.repository.list();
      if (listed.status !== "success") {
        return rejected("CITY_PERSISTENCE_FAILED", { ownerCode: listed.code });
      }
      return success(
        Object.freeze(
          [...listed.value]
            .sort(compareSummaries)
            .map((item) => Object.freeze({ ...item })),
        ),
      );
    },
  };
  return Object.freeze(service);
}
