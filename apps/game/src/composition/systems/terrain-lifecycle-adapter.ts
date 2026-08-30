import type {
  LifecyclePortResult,
  PreparedTerrainHandle,
  TerrainLifecyclePort,
  TerrainSessionHandle,
} from "@web-three-city/orchestration-city-session";
import type { MapDefinitionRead } from "@web-three-city/world";
import {
  createTerrainSystem,
  prepareProductionTerrain,
  restoreTerrainSystem,
  type PreparedProductionTerrain,
  type TerrainConstructionResult,
  type TerrainSystem,
} from "@web-three-city/terrain/composition";

const PREPARED_TERRAIN_TOKEN = Symbol("prepared-terrain-adapter-token");

interface PreparedTerrainOpaque {
  readonly token: typeof PREPARED_TERRAIN_TOKEN;
  readonly prepared: PreparedProductionTerrain;
  readonly mapDefinition: MapDefinitionRead;
}

function reject<T>(code: string): LifecyclePortResult<T> {
  return Object.freeze({ status: "rejected", code });
}

function adaptTerrainSystem(
  result: TerrainConstructionResult<TerrainSystem>,
): LifecyclePortResult<TerrainSessionHandle> {
  if (result.status !== "success") {
    return Object.freeze({
      status: "rejected",
      code: result.reason,
      ...(result.detail === undefined ? {} : { detail: result.detail }),
    });
  }
  const system = result.value;
  return {
    status: "success",
    value: Object.freeze({
      read: system.read,
      opaque: system,
      captureSnapshot: () => system.captureSnapshot(),
    }),
  };
}

function preparedOpaque(
  handle: PreparedTerrainHandle,
): PreparedTerrainOpaque | undefined {
  if (typeof handle.opaque !== "object" || handle.opaque === null)
    return undefined;
  const candidate = handle.opaque as Partial<PreparedTerrainOpaque>;
  return candidate.token === PREPARED_TERRAIN_TOKEN &&
    candidate.prepared !== undefined &&
    candidate.mapDefinition !== undefined
    ? (candidate as PreparedTerrainOpaque)
    : undefined;
}

export function createTerrainLifecycleAdapter(): TerrainLifecyclePort {
  const adapter: TerrainLifecyclePort = {
    prepare(world, seed64) {
      const result = prepareProductionTerrain({ world, seed64 });
      if (result.status !== "success") {
        return Object.freeze({
          status: "rejected",
          code: result.code,
          ...(result.detail === undefined ? {} : { detail: result.detail }),
        });
      }
      const prepared = result.value;
      const opaque: PreparedTerrainOpaque = Object.freeze({
        token: PREPARED_TERRAIN_TOKEN,
        prepared,
        mapDefinition: world.mapDefinition,
      });
      return Object.freeze({
        status: "success",
        value: Object.freeze({
          selectedSeed64: prepared.selectedSeed64,
          fingerprint: prepared.fingerprint,
          eligibleStartingRegionIds: Object.freeze(
            prepared.candidateEvaluations
              .filter((candidate) => candidate.eligible)
              .map((candidate) => candidate.regionId),
          ),
          opaque,
        }),
      });
    },
    create(world, preparedTerrain) {
      const opaque = preparedOpaque(preparedTerrain);
      if (opaque === undefined)
        return reject("TERRAIN_PREPARED_HANDLE_INVALID");
      return adaptTerrainSystem(
        createTerrainSystem({
          world,
          mapDefinitionId: opaque.mapDefinition.mapDefinitionId,
          generationProfileId: opaque.mapDefinition.terrainGenerationProfileId,
          generationProfileVersion:
            opaque.mapDefinition.terrainGenerationProfileVersion,
          selectedSeed64: opaque.prepared.selectedSeed64,
          fingerprint: opaque.prepared.fingerprint,
          source: opaque.prepared.field,
        }),
      );
    },
    restore(world, snapshot) {
      return adaptTerrainSystem(
        restoreTerrainSystem({
          world,
          mapDefinitionId: snapshot.mapDefinitionId,
          snapshot,
        }),
      );
    },
  };
  return Object.freeze(adapter);
}
