import type {
  LifecyclePortResult,
  TerrainLifecyclePort,
  TerrainSessionHandle,
} from "@web-three-city/orchestration-city-session";
import {
  createTerrainSystem,
  prepareProductionTerrain,
  restoreTerrainSystem,
  type TerrainConstructionResult,
  type TerrainSystem,
} from "@web-three-city/terrain/composition";
import {
  createPreparedTerrainOpaque,
  readPreparedTerrainPresentationSource,
} from "./prepared-terrain-handle";

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
      commands: system.commands,
      opaque: system,
      captureSnapshot: () => system.captureSnapshot(),
    }),
  };
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
          opaque: createPreparedTerrainOpaque({
            prepared,
            mapDefinition: world.mapDefinition,
          }),
        }),
      });
    },
    create(world, preparedTerrain) {
      const source = readPreparedTerrainPresentationSource(preparedTerrain);
      if (source === undefined)
        return reject("TERRAIN_PREPARED_HANDLE_INVALID");
      return adaptTerrainSystem(
        createTerrainSystem({
          world,
          mapDefinitionId: source.mapDefinition.mapDefinitionId,
          generationProfileId: source.mapDefinition.terrainGenerationProfileId,
          generationProfileVersion:
            source.mapDefinition.terrainGenerationProfileVersion,
          selectedSeed64: source.prepared.selectedSeed64,
          fingerprint: source.prepared.fingerprint,
          source: source.prepared.field,
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
