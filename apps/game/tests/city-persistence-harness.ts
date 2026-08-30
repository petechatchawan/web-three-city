import {
  parseCityId,
  parseCityName,
  type CityId,
  type CitySaveV1,
} from "@web-three-city/orchestration-city-session";
import {
  CITY_SAVE_INDEX_LAST_PLAYED_AT,
  CITY_SAVE_INDEX_UPDATED_AT,
  CITY_SAVE_STORE_NAME,
} from "../src/persistence/city-save-schema";
import { createIndexedDbCitySaveRepository } from "../src/persistence/create-indexeddb-city-save-repository";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null)
    throw new Error(`Required element ${selector} is missing.`);
  return element;
}

const root = requiredElement<HTMLElement>("#city-persistence-test");

function id(value: string): CityId {
  const parsed = parseCityId(value);
  if (parsed.status !== "success")
    throw new Error(`Invalid test city id ${value}`);
  return parsed.value;
}

function name(value: string) {
  const parsed = parseCityName(value);
  if (parsed.status !== "success")
    throw new Error(`Invalid test city name ${value}`);
  return parsed.value;
}

function save(input: {
  readonly cityId: string;
  readonly lastPlayedAt: string;
  readonly updatedAt?: string;
}): CitySaveV1 {
  const updatedAt = input.updatedAt ?? input.lastPlayedAt;
  return {
    schemaVersion: 1,
    metadata: {
      cityId: id(input.cityId),
      name: name(`City ${input.cityId}`),
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt,
      lastPlayedAt: input.lastPlayedAt,
    },
    worldSnapshot: {
      mapDefinitionId: "web-three-city-production",
      mapProfileId: "production-v1",
      mapProfileVersion: 1,
      startingRegionId: "R06",
      unlockedRegionIds: ["R06"],
    },
    terrainSnapshot: {
      snapshotVersion: 1,
      mapDefinitionId: "web-three-city-production",
      generationProfileId: "balanced-temperate-generation",
      generationProfileVersion: 2,
      selectedSeed64: "0x1234567890ABCDEF",
      fingerprint: "0x1111222233334444",
      revision: 4,
      completeness: "full",
      chunks: [],
    },
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed.")),
      {
        once: true,
      },
    );
  });
}

const FORBIDDEN_PERSISTED_KEY_PARTS = Object.freeze([
  "mesh",
  "material",
  "camera",
  "debug",
  "rendersector",
  "buffergeometry",
  "gpu",
]);

function findForbiddenPersistedKey(
  value: unknown,
  path = "root",
): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = findForbiddenPersistedKey(entry, `${path}[${index}]`);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      FORBIDDEN_PERSISTED_KEY_PARTS.some((part) => normalized.includes(part))
    ) {
      return `${path}.${key}`;
    }
    const found = findForbiddenPersistedKey(entry, `${path}.${key}`);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function readRawRecords(
  databaseName: string,
): Promise<readonly unknown[]> {
  const request = indexedDB.open(databaseName);
  const database = await requestResult(request);
  try {
    const transaction = database.transaction(CITY_SAVE_STORE_NAME, "readonly");
    return await requestResult(
      transaction.objectStore(CITY_SAVE_STORE_NAME).getAll(),
    );
  } finally {
    database.close();
  }
}

async function injectCorruptRecord(databaseName: string): Promise<void> {
  const request = indexedDB.open(databaseName);
  const database = await requestResult(request);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        CITY_SAVE_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(CITY_SAVE_STORE_NAME).put({
        ...save({
          cityId: "corrupt",
          lastPlayedAt: "2026-08-30T04:00:00.000Z",
        }),
        schemaVersion: 99,
      });
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener(
        "abort",
        () =>
          reject(
            transaction.error ?? new Error("IndexedDB transaction failed."),
          ),
        {
          once: true,
        },
      );
      transaction.addEventListener(
        "error",
        () =>
          reject(
            transaction.error ?? new Error("IndexedDB transaction failed."),
          ),
        {
          once: true,
        },
      );
    });
  } finally {
    database.close();
  }
}

async function readIndexNames(
  databaseName: string,
): Promise<readonly string[]> {
  const request = indexedDB.open(databaseName);
  const database = await requestResult(request);
  try {
    const transaction = database.transaction(CITY_SAVE_STORE_NAME, "readonly");
    return [...transaction.objectStore(CITY_SAVE_STORE_NAME).indexNames].sort(
      (left, right) => left.localeCompare(right),
    );
  } finally {
    database.close();
  }
}

async function main(): Promise<void> {
  const databaseName = new URLSearchParams(location.search).get("db");
  if (databaseName === null || databaseName.length === 0) {
    throw new Error("Persistence test requires ?db=<name>.");
  }

  const repository = createIndexedDbCitySaveRepository({ databaseName });
  const sameTime = "2026-08-30T03:00:00.000Z";
  const olderTime = "2026-08-30T01:00:00.000Z";

  for (const record of [
    save({ cityId: "city-b", lastPlayedAt: sameTime }),
    save({ cityId: "city-c", lastPlayedAt: olderTime }),
    save({ cityId: "city-a", lastPlayedAt: sameTime }),
  ]) {
    const result = await repository.save(record);
    if (result.status !== "success")
      throw new Error(`save failed: ${result.code}`);
  }

  const listed = await repository.list();
  if (listed.status !== "success")
    throw new Error(`list failed: ${listed.code}`);
  root.dataset.list = listed.value.map((item) => item.cityId).join(",");

  const latest = await repository.latest();
  if (latest.status !== "success")
    throw new Error(`latest failed: ${latest.code}`);
  root.dataset.latest = latest.value?.metadata.cityId ?? "none";

  const loaded = await repository.load(id("city-b"));
  if (loaded.status !== "success")
    throw new Error(`load failed: ${loaded.code}`);
  root.dataset.loaded = loaded.value?.metadata.cityId ?? "none";

  const removed = await repository.remove(id("city-b"));
  if (removed.status !== "success")
    throw new Error(`remove failed: ${removed.code}`);
  const afterRemove = await repository.list();
  if (afterRemove.status !== "success") {
    throw new Error(`list after remove failed: ${afterRemove.code}`);
  }
  root.dataset.afterRemove = afterRemove.value
    .map((item) => item.cityId)
    .join(",");

  root.dataset.indexes = (await readIndexNames(databaseName)).join(",");
  const forbiddenKey = findForbiddenPersistedKey(
    await readRawRecords(databaseName),
  );
  root.dataset.authorityPayload = forbiddenKey ?? "clean";
  await injectCorruptRecord(databaseName);
  const corrupt = await repository.load(id("corrupt"));
  root.dataset.corrupt =
    corrupt.status === "failure" ? corrupt.code : "not-rejected";

  root.dataset.expectedIndexes = [
    CITY_SAVE_INDEX_LAST_PLAYED_AT,
    CITY_SAVE_INDEX_UPDATED_AT,
  ]
    .sort((left, right) => left.localeCompare(right))
    .join(",");
  root.dataset.status = "ready";

  window.addEventListener(
    "pagehide",
    () => {
      repository.dispose();
    },
    { once: true },
  );
}

try {
  await main();
} catch (error: unknown) {
  root.dataset.status = "error";
  root.dataset.error = error instanceof Error ? error.message : String(error);
}
