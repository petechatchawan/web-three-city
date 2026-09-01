import type { PreparedTerrainHandle } from "@web-three-city/orchestration-city-session";
import type { MapDefinitionRead } from "@web-three-city/world";
import type { PreparedProductionTerrain } from "@web-three-city/terrain/composition";

const PREPARED_TERRAIN_TOKEN = Symbol("prepared-terrain-adapter-token");

interface PreparedTerrainOpaque {
  readonly token: typeof PREPARED_TERRAIN_TOKEN;
  readonly prepared: PreparedProductionTerrain;
  readonly mapDefinition: MapDefinitionRead;
}

export interface PreparedTerrainPresentationSource {
  readonly prepared: PreparedProductionTerrain;
  readonly mapDefinition: MapDefinitionRead;
}

export function createPreparedTerrainOpaque(input: {
  readonly prepared: PreparedProductionTerrain;
  readonly mapDefinition: MapDefinitionRead;
}): unknown {
  const opaque: PreparedTerrainOpaque = Object.freeze({
    token: PREPARED_TERRAIN_TOKEN,
    prepared: input.prepared,
    mapDefinition: input.mapDefinition,
  });
  return opaque;
}

export function readPreparedTerrainPresentationSource(
  handle: PreparedTerrainHandle,
): PreparedTerrainPresentationSource | undefined {
  if (typeof handle.opaque !== "object" || handle.opaque === null) {
    return undefined;
  }
  const candidate = handle.opaque as Partial<PreparedTerrainOpaque>;
  if (
    candidate.token !== PREPARED_TERRAIN_TOKEN ||
    candidate.prepared === undefined ||
    candidate.mapDefinition === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    prepared: candidate.prepared,
    mapDefinition: candidate.mapDefinition,
  });
}
