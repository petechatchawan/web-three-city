import type {
  TerrainAuthorityRead,
  TerrainStateSnapshotV1,
} from "@web-three-city/terrain";
import type {
  MapStateSnapshot,
  PreparedWorldDefinition,
  RegionId,
  WorldSystem,
} from "@web-three-city/world";
import { describe, expect, it } from "vitest";
import {
  decodeCitySaveV1,
  parseCityId,
  parseCityName,
  summarizeCitySave,
  type CityId,
  type CityRepositoryResult,
  type CitySaveRepository,
  type CitySaveSummary,
  type CitySaveV1,
  type Clock,
  type IdSource,
  type LifecyclePortResult,
  type PreparedTerrainHandle,
  type TerrainLifecyclePort,
  type TerrainSessionHandle,
  type WorldLifecyclePort,
} from "../src/index";
import { createCitySessionService } from "../src/composition";

const CREATED_AT = "2026-08-30T00:00:00.000Z";
const NEXT_AT = "2026-08-30T01:00:00.000Z";
const MAP_ID = "web-three-city-production";
const SEED = "0x1234567890ABCDEF";
const FINGERPRINT = "0x1111222233334444";

function cityId(value = "city-a"): CityId {
  const parsed = parseCityId(value);
  if (parsed.status !== "success") throw new Error("invalid test city id");
  return parsed.value;
}

function cityName(value = "Alpha City") {
  const parsed = parseCityName(value);
  if (parsed.status !== "success") throw new Error("invalid test city name");
  return parsed.value;
}

const worldSnapshot: MapStateSnapshot = {
  mapDefinitionId: MAP_ID,
  mapProfileId: "production-v1",
  mapProfileVersion: 1,
  startingRegionId: "R06",
  unlockedRegionIds: ["R06"],
};

const terrainSnapshot: TerrainStateSnapshotV1 = {
  snapshotVersion: 1,
  mapDefinitionId: MAP_ID,
  generationProfileId: "balanced-temperate-generation",
  generationProfileVersion: 2,
  selectedSeed64: SEED,
  fingerprint: FINGERPRINT,
  revision: 3,
  completeness: "full",
  chunks: [],
};

const preparedWorld = {
  mapDefinition: {
    mapDefinitionId: MAP_ID,
    profileId: "production-v1",
    profileVersion: 1,
    widthCells: 512,
    heightCells: 512,
    cellSizeMeters: 8,
    logicalChunkSizeCells: 32,
    terrainGenerationProfileId: "balanced-temperate-generation",
    terrainGenerationProfileVersion: 2,
    regionIds: ["R06", "R08"],
    startingCandidates: [
      { regionId: "R06", anchor: { x: 10, z: 10 } },
      { regionId: "R08", anchor: { x: 20, z: 20 } },
    ],
  },
  spatial: {},
} as unknown as PreparedWorldDefinition;

function createWorldSystem(snapshot = worldSnapshot): WorldSystem {
  return {
    definition: preparedWorld,
    spatial: preparedWorld.spatial,
    mapState: {
      mapDefinitionId: snapshot.mapDefinitionId,
      startingRegionId: snapshot.startingRegionId,
      unlockedRegionIds: snapshot.unlockedRegionIds,
    },
    captureSnapshot: () => snapshot,
  };
}

function createTerrainSession(
  snapshot = terrainSnapshot,
): TerrainSessionHandle {
  return {
    read: {} as TerrainAuthorityRead,
    opaque: { kind: "terrain-system" },
    captureSnapshot: () => snapshot,
  };
}

function ok<T>(value: T): LifecyclePortResult<T> {
  return { status: "success", value };
}

class MemoryRepository implements CitySaveRepository {
  readonly saves = new Map<CityId, CitySaveV1>();
  readonly saveCalls: CitySaveV1[] = [];
  failSave = false;
  corruptLoad: CitySaveV1 | undefined;
  listOverride: readonly CitySaveSummary[] | undefined;

  async list(): Promise<CityRepositoryResult<readonly CitySaveSummary[]>> {
    if (this.listOverride !== undefined)
      return { status: "success", value: this.listOverride };
    return {
      status: "success",
      value: [...this.saves.values()].map(summarizeCitySave),
    };
  }
  async load(
    id: CityId,
  ): Promise<CityRepositoryResult<CitySaveV1 | undefined>> {
    return {
      status: "success",
      value: this.corruptLoad ?? this.saves.get(id),
    };
  }
  async latest(): Promise<CityRepositoryResult<CitySaveV1 | undefined>> {
    const ordered = [...this.saves.values()].sort((a, b) => {
      const time = b.metadata.lastPlayedAt.localeCompare(
        a.metadata.lastPlayedAt,
      );
      return time || a.metadata.cityId.localeCompare(b.metadata.cityId);
    });
    return { status: "success", value: ordered[0] };
  }
  async save(save: CitySaveV1): Promise<CityRepositoryResult<void>> {
    this.saveCalls.push(save);
    if (this.failSave)
      return { status: "failure", code: "CITY_REPOSITORY_WRITE_FAILED" };
    this.saves.set(save.metadata.cityId, save);
    return { status: "success", value: undefined };
  }
  async remove(id: CityId): Promise<CityRepositoryResult<void>> {
    this.saves.delete(id);
    return { status: "success", value: undefined };
  }
}

function createHarness(
  times = [CREATED_AT, NEXT_AT, "2026-08-30T02:00:00.000Z"],
) {
  const repo = new MemoryRepository();
  const worldCalls = { prepare: 0, create: 0, restore: 0 };
  const terrainCalls = { prepare: 0, create: 0, restore: 0 };
  const preparedTerrain: PreparedTerrainHandle = {
    selectedSeed64: SEED,
    fingerprint: FINGERPRINT,
    eligibleStartingRegionIds: ["R06", "R08"],
    opaque: { exact: "prepared-field" },
  };
  const worldSystem = createWorldSystem();
  const terrainSession = createTerrainSession();
  const world: WorldLifecyclePort = {
    prepareDefinition() {
      worldCalls.prepare += 1;
      return ok(preparedWorld);
    },
    createInitial(input) {
      worldCalls.create += 1;
      expect(input.prepared).toBe(preparedWorld);
      return ok(worldSystem);
    },
    restore(snapshot) {
      worldCalls.restore += 1;
      return ok(createWorldSystem(snapshot));
    },
  };
  const terrain: TerrainLifecyclePort = {
    prepare(worldDefinition, seed64) {
      terrainCalls.prepare += 1;
      expect(worldDefinition).toBe(preparedWorld);
      expect(seed64).toBe(SEED);
      return ok(preparedTerrain);
    },
    create(worldSpatial, prepared) {
      terrainCalls.create += 1;
      expect(worldSpatial).toBe(worldSystem.spatial);
      expect(prepared).toBe(preparedTerrain);
      return ok(terrainSession);
    },
    restore(worldSpatial, snapshot) {
      terrainCalls.restore += 1;
      expect(worldSpatial).toBe(preparedWorld.spatial);
      return ok(createTerrainSession(snapshot));
    },
  };
  let timeIndex = 0;
  const clock: Clock = {
    nowIso() {
      const value = times[Math.min(timeIndex, times.length - 1)]!;
      timeIndex += 1;
      return value;
    },
  };
  const ids: IdSource = { nextCityId: () => cityId() };
  const service = createCitySessionService({
    world,
    terrain,
    repository: repo,
    clock,
    ids,
  });
  return {
    service,
    repo,
    worldCalls,
    terrainCalls,
    preparedTerrain,
    worldSystem,
    terrainSession,
  };
}

function validSave(id = cityId()): CitySaveV1 {
  return {
    schemaVersion: 1,
    metadata: {
      cityId: id,
      name: cityName(),
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      lastPlayedAt: CREATED_AT,
    },
    worldSnapshot,
    terrainSnapshot,
  };
}

describe("city save decoding", () => {
  it("rejects unsupported schema and malformed metadata without coercion", () => {
    expect(
      decodeCitySaveV1({ ...validSave(), schemaVersion: 2 }),
    ).toMatchObject({
      status: "rejected",
      code: "CITY_SAVE_SCHEMA_UNSUPPORTED",
    });
    expect(
      decodeCitySaveV1({
        ...validSave(),
        metadata: { ...validSave().metadata, name: "   " },
      }),
    ).toMatchObject({ status: "rejected", code: "CITY_SAVE_METADATA_INVALID" });
  });

  it("summarizes canonical owner facts without duplicating authority", () => {
    expect(summarizeCitySave(validSave())).toEqual({
      cityId: cityId(),
      name: cityName(),
      updatedAt: CREATED_AT,
      lastPlayedAt: CREATED_AT,
      selectedSeed64: SEED,
      fingerprint: FINGERPRINT,
      terrainRevision: 3,
      startingRegionId: "R06",
    });
  });
});

describe("city lifecycle orchestration", () => {
  it("prepares a new city once, normalizes name, and preserves exact prepared terrain", () => {
    const h = createHarness();
    const result = h.service.prepareNewCity({
      name: "  Alpha City  ",
      seed64: SEED,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.value.name).toBe("Alpha City");
    expect(result.value.preparedTerrain).toBe(h.preparedTerrain);
    expect(result.value.eligibleStartingRegionIds).toEqual(["R06", "R08"]);
    expect(h.worldCalls.prepare).toBe(1);
    expect(h.terrainCalls.prepare).toBe(1);
  });

  it("rejects invalid name before preparing systems", () => {
    const h = createHarness();
    expect(
      h.service.prepareNewCity({ name: "   ", seed64: SEED }),
    ).toMatchObject({
      status: "rejected",
      code: "CITY_NAME_REQUIRED",
    });
    expect(h.worldCalls.prepare).toBe(0);
    expect(h.terrainCalls.prepare).toBe(0);
  });

  it("rejects an ineligible starting Region before committing systems", async () => {
    const h = createHarness();
    const preview = h.service.prepareNewCity({ name: "Alpha", seed64: SEED });
    if (preview.status !== "success") throw new Error("expected preview");
    const result = await h.service.createNewCity({
      preview: preview.value,
      selectedStartingRegionId: "R99" as RegionId,
    });
    expect(result).toMatchObject({
      status: "rejected",
      code: "CITY_STARTING_REGION_NOT_ELIGIBLE",
    });
    expect(h.worldCalls.create).toBe(0);
    expect(h.terrainCalls.create).toBe(0);
    expect(h.repo.saveCalls).toHaveLength(0);
  });

  it("creates from the exact preview without regenerating and persists the initial canonical save", async () => {
    const h = createHarness();
    const preview = h.service.prepareNewCity({ name: "Alpha", seed64: SEED });
    if (preview.status !== "success") throw new Error("expected preview");
    const result = await h.service.createNewCity({
      preview: preview.value,
      selectedStartingRegionId: "R06",
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(h.terrainCalls.prepare).toBe(1);
    expect(h.worldCalls.create).toBe(1);
    expect(h.terrainCalls.create).toBe(1);
    expect(h.repo.saveCalls).toHaveLength(1);
    expect(h.repo.saveCalls[0]).toMatchObject({
      schemaVersion: 1,
      metadata: {
        cityId: "city-a",
        name: "Alpha",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        lastPlayedAt: CREATED_AT,
      },
      worldSnapshot,
      terrainSnapshot,
    });
  });

  it("keeps live metadata unchanged when an explicit save fails", async () => {
    const h = createHarness();
    h.repo.saves.set(cityId(), validSave());
    h.repo.failSave = true;
    const session = {
      metadata: validSave().metadata,
      world: h.worldSystem,
      terrain: h.terrainSession,
    };
    const result = await h.service.saveCity(session);
    expect(result).toMatchObject({
      status: "rejected",
      code: "CITY_PERSISTENCE_FAILED",
    });
    expect(session.metadata.updatedAt).toBe(CREATED_AT);
    expect(session.metadata.lastPlayedAt).toBe(CREATED_AT);
  });

  it("loads by restoring owner snapshots then persists only the new lastPlayedAt", async () => {
    const h = createHarness([NEXT_AT]);
    h.repo.saves.set(cityId(), validSave());
    const result = await h.service.loadCity(cityId());
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(h.worldCalls.restore).toBe(1);
    expect(h.terrainCalls.restore).toBe(1);
    expect(result.value.metadata.updatedAt).toBe(CREATED_AT);
    expect(result.value.metadata.lastPlayedAt).toBe(NEXT_AT);
    expect(h.repo.saveCalls.at(-1)?.metadata.lastPlayedAt).toBe(NEXT_AT);
  });

  it("reports persistence failure if lastPlayedAt cannot be durably recorded after restore", async () => {
    const h = createHarness([NEXT_AT]);
    h.repo.saves.set(cityId(), validSave());
    h.repo.failSave = true;
    const result = await h.service.loadCity(cityId());
    expect(result).toMatchObject({
      status: "rejected",
      code: "CITY_PERSISTENCE_FAILED",
    });
    expect(h.worldCalls.restore).toBe(1);
    expect(h.terrainCalls.restore).toBe(1);
  });

  it("rejects corrupt loaded data before owner restore", async () => {
    const h = createHarness();
    h.repo.corruptLoad = {
      ...validSave(),
      schemaVersion: 2,
    } as unknown as CitySaveV1;
    const result = await h.service.loadCity(cityId());
    expect(result).toMatchObject({
      status: "rejected",
      code: "CITY_SAVE_INVALID",
    });
    expect(h.worldCalls.restore).toBe(0);
    expect(h.terrainCalls.restore).toBe(0);
  });

  it("resumes the lexical-first city when latest timestamps tie", async () => {
    const h = createHarness([NEXT_AT]);
    const tiedAt = "2026-08-30T03:00:00.000Z";
    h.repo.saves.set(
      cityId("city-b"),
      validSave(cityId("city-b"), { lastPlayedAt: tiedAt }),
    );
    h.repo.saves.set(
      cityId("city-a"),
      validSave(cityId("city-a"), { lastPlayedAt: tiedAt }),
    );

    const result = await h.service.resumeCity();
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.metadata.cityId).toBe("city-a");
    }
  });

  it("returns empty resume and canonical list ordering", async () => {
    const h = createHarness();
    expect(await h.service.resumeCity()).toEqual({ status: "empty" });
    h.repo.listOverride = [
      {
        ...summarizeCitySave(validSave(cityId("city-b"))),
        lastPlayedAt: CREATED_AT,
      },
      {
        ...summarizeCitySave(validSave(cityId("city-a"))),
        lastPlayedAt: NEXT_AT,
      },
      {
        ...summarizeCitySave(validSave(cityId("city-c"))),
        lastPlayedAt: CREATED_AT,
      },
    ];
    const listed = await h.service.listCities();
    expect(listed.status).toBe("success");
    if (listed.status === "success") {
      expect(listed.value.map((item) => item.cityId)).toEqual([
        "city-a",
        "city-b",
        "city-c",
      ]);
    }
  });
});
