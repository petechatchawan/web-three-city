import {
  decodeCitySaveV1,
  summarizeCitySave,
  type CityId,
  type CityRepositoryResult,
  type CitySaveRepository,
  type CitySaveSummary,
  type CitySaveV1,
} from "@web-three-city/orchestration-city-session";
import {
  CITY_SAVE_DATABASE_NAME,
  CITY_SAVE_DATABASE_VERSION,
  CITY_SAVE_INDEX_LAST_PLAYED_AT,
  CITY_SAVE_INDEX_UPDATED_AT,
  CITY_SAVE_KEY_PATH,
  CITY_SAVE_LAST_PLAYED_AT_KEY_PATH,
  CITY_SAVE_STORE_NAME,
  CITY_SAVE_UPDATED_AT_KEY_PATH,
} from "./city-save-schema";

export interface IndexedDbCitySaveRepository extends CitySaveRepository {
  dispose(): void;
}

interface RepositoryOptions {
  readonly databaseName?: string;
}

function failure<T>(
  code: Exclude<CityRepositoryResult<T>, { status: "success" }>["code"],
  detail?: Readonly<Record<string, unknown>>,
): CityRepositoryResult<T> {
  return detail === undefined
    ? Object.freeze({ status: "failure", code })
    : Object.freeze({ status: "failure", code, detail });
}

function success<T>(value: T): CityRepositoryResult<T> {
  return Object.freeze({ status: "success", value });
}

function errorDetail(error: unknown): Readonly<Record<string, unknown>> {
  return Object.freeze({
    message: error instanceof Error ? error.message : String(error),
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed.")),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () =>
        reject(
          transaction.error ?? new Error("IndexedDB transaction aborted."),
        ),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    );
  });
}

function ensureSchema(database: IDBDatabase): void {
  const store = database.objectStoreNames.contains(CITY_SAVE_STORE_NAME)
    ? undefined
    : database.createObjectStore(CITY_SAVE_STORE_NAME, {
        keyPath: CITY_SAVE_KEY_PATH,
      });
  if (store === undefined) return;
  store.createIndex(
    CITY_SAVE_INDEX_LAST_PLAYED_AT,
    CITY_SAVE_LAST_PLAYED_AT_KEY_PATH,
  );
  store.createIndex(CITY_SAVE_INDEX_UPDATED_AT, CITY_SAVE_UPDATED_AT_KEY_PATH);
}

function compareSaves(left: CitySaveV1, right: CitySaveV1): number {
  return (
    right.metadata.lastPlayedAt.localeCompare(left.metadata.lastPlayedAt) ||
    left.metadata.cityId.localeCompare(right.metadata.cityId)
  );
}

function decodeRecords(
  values: readonly unknown[],
): CityRepositoryResult<readonly CitySaveV1[]> {
  const decoded: CitySaveV1[] = [];
  for (const value of values) {
    const result = decodeCitySaveV1(value);
    if (result.status !== "success") {
      return failure("CITY_REPOSITORY_CORRUPT", { ownerCode: result.code });
    }
    decoded.push(result.value);
  }
  return success(Object.freeze(decoded));
}

export function createIndexedDbCitySaveRepository(
  options: RepositoryOptions = {},
): IndexedDbCitySaveRepository {
  const databaseName = options.databaseName ?? CITY_SAVE_DATABASE_NAME;
  let disposed = false;
  let database: IDBDatabase | undefined;
  let opening: Promise<IDBDatabase> | undefined;

  const open = (): Promise<IDBDatabase> => {
    if (disposed)
      return Promise.reject(new Error("City save repository is disposed."));
    if (database !== undefined) return Promise.resolve(database);
    if (opening !== undefined) return opening;

    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, CITY_SAVE_DATABASE_VERSION);
      request.addEventListener(
        "upgradeneeded",
        () => {
          ensureSchema(request.result);
        },
        { once: true },
      );
      request.addEventListener(
        "success",
        () => {
          const opened = request.result;
          if (disposed) {
            opened.close();
            reject(
              new Error("City save repository was disposed while opening."),
            );
            return;
          }
          database = opened;
          opened.addEventListener("versionchange", () => {
            opened.close();
            if (database === opened) database = undefined;
          });
          resolve(opened);
        },
        { once: true },
      );
      request.addEventListener(
        "error",
        () => reject(request.error ?? new Error("IndexedDB open failed.")),
        { once: true },
      );
      request.addEventListener(
        "blocked",
        () => reject(new Error("IndexedDB upgrade was blocked.")),
        { once: true },
      );
    }).finally(() => {
      opening = undefined;
    });
    return opening;
  };

  const readAll = async (): Promise<
    CityRepositoryResult<readonly CitySaveV1[]>
  > => {
    try {
      const db = await open();
      const transaction = db.transaction(CITY_SAVE_STORE_NAME, "readonly");
      const values = await requestValue(
        transaction.objectStore(CITY_SAVE_STORE_NAME).getAll(),
      );
      await transactionComplete(transaction);
      return decodeRecords(values);
    } catch (error) {
      return failure("CITY_REPOSITORY_READ_FAILED", errorDetail(error));
    }
  };

  const repository: IndexedDbCitySaveRepository = {
    async list() {
      const records = await readAll();
      if (records.status !== "success") return records;
      const summaries: CitySaveSummary[] = [...records.value]
        .sort(compareSaves)
        .map(summarizeCitySave);
      return success(Object.freeze(summaries));
    },

    async load(cityId: CityId) {
      try {
        const db = await open();
        const transaction = db.transaction(CITY_SAVE_STORE_NAME, "readonly");
        const raw = await requestValue(
          transaction.objectStore(CITY_SAVE_STORE_NAME).get(cityId),
        );
        await transactionComplete(transaction);
        if (raw === undefined) return success(undefined);
        const decoded = decodeCitySaveV1(raw);
        return decoded.status === "success"
          ? success(decoded.value)
          : failure("CITY_REPOSITORY_CORRUPT", { ownerCode: decoded.code });
      } catch (error) {
        return failure("CITY_REPOSITORY_READ_FAILED", errorDetail(error));
      }
    },

    async latest() {
      const records = await readAll();
      if (records.status !== "success") return records;
      const [latest] = [...records.value].sort(compareSaves);
      return success(latest);
    },

    async save(save: CitySaveV1) {
      const decoded = decodeCitySaveV1(save);
      if (decoded.status !== "success") {
        return failure("CITY_REPOSITORY_CORRUPT", { ownerCode: decoded.code });
      }
      try {
        const db = await open();
        const transaction = db.transaction(CITY_SAVE_STORE_NAME, "readwrite");
        await requestValue(
          transaction.objectStore(CITY_SAVE_STORE_NAME).put(decoded.value),
        );
        await transactionComplete(transaction);
        return success(undefined);
      } catch (error) {
        return failure("CITY_REPOSITORY_WRITE_FAILED", errorDetail(error));
      }
    },

    async remove(cityId: CityId) {
      try {
        const db = await open();
        const transaction = db.transaction(CITY_SAVE_STORE_NAME, "readwrite");
        await requestValue(
          transaction.objectStore(CITY_SAVE_STORE_NAME).delete(cityId),
        );
        await transactionComplete(transaction);
        return success(undefined);
      } catch (error) {
        return failure("CITY_REPOSITORY_DELETE_FAILED", errorDetail(error));
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      database?.close();
      database = undefined;
    },
  };

  return Object.freeze(repository);
}
