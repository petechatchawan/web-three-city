import {
  createEmptyRoadSnapshot,
  decodeRoadSaveV1,
  encodeRoadSaveV1,
  roadCellPolicyInvalidReason,
  roadOccupiedAt,
  type RoadPlacementEnvironment,
  type RoadSaveV1,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import {
  decodeTerrainSaveV1,
  encodeTerrainSaveV1,
  type TerrainSaveV1,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import { createRoadPlacementEnvironment } from './road-placement-environment.js';

export interface WorldSaveV1 {
  readonly kind: 'world-save';
  readonly schemaVersion: 1;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
}

export interface DecodedWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly roadEnvironment: RoadPlacementEnvironment;
}

export type WorldSaveErrorCode =
  | 'world-save:invalid-schema'
  | 'world-save:invalid-terrain'
  | 'world-save:invalid-water'
  | 'world-save:invalid-roads'
  | 'world-save:invalid-road-environment'
  | 'world-save:invalid-road-placement';

export interface WorldSaveError {
  readonly code: WorldSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorldEnvelope(input: unknown): input is Record<string, unknown> {
  return isRecord(input) && (input.kind === 'world-save' || 'roads' in input || 'terrain' in input);
}

export function encodeWorldSaveV1(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
): WorldSaveV1 {
  return Object.freeze({
    kind: 'world-save' as const,
    schemaVersion: 1 as const,
    terrain: encodeTerrainSaveV1(terrain),
    roads: encodeRoadSaveV1(roads),
  });
}

export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError> {
  let terrainInput: unknown = input;
  let roadInput: unknown = null;
  let legacy = true;

  if (isWorldEnvelope(input)) {
    if (input.kind !== 'world-save' || input.schemaVersion !== 1 || !('terrain' in input)) {
      return err({ code: 'world-save:invalid-schema' });
    }
    terrainInput = input.terrain;
    roadInput = input.roads;
    legacy = false;
  }

  const terrainResult = decodeTerrainSaveV1(terrainInput);
  if (!terrainResult.ok) {
    return err({
      code: 'world-save:invalid-terrain',
      details: Object.freeze({ terrainCode: terrainResult.error.code }),
    });
  }
  const terrain = terrainResult.value;

  const waterResult = deriveWaterSnapshot(terrain, config);
  if (!waterResult.ok) {
    return err({
      code: 'world-save:invalid-water',
      details: Object.freeze({ waterCode: waterResult.error.code }),
    });
  }
  const water = waterResult.value;

  let roads: RoadSnapshot;
  if (legacy) {
    roads = createEmptyRoadSnapshot(config);
  } else {
    const roadResult = decodeRoadSaveV1(roadInput, config);
    if (!roadResult.ok) {
      return err({
        code: 'world-save:invalid-roads',
        details: Object.freeze({ roadCode: roadResult.error.code }),
      });
    }
    roads = roadResult.value;
  }

  let roadEnvironment: RoadPlacementEnvironment;
  try {
    roadEnvironment = createRoadPlacementEnvironment(terrain, water, config);
  } catch {
    return err({ code: 'world-save:invalid-road-environment' });
  }

  for (let z = 0; z < config.mapHeight; z += 1) {
    for (let x = 0; x < config.mapWidth; x += 1) {
      const cell = { x, z };
      if (!roadOccupiedAt(roads, cell)) continue;
      const reason = roadCellPolicyInvalidReason(roads, cell, roadEnvironment, config);
      if (reason !== null) {
        return err({
          code: 'world-save:invalid-road-placement',
          details: Object.freeze({ reason }),
        });
      }
    }
  }

  return ok(
    Object.freeze({
      terrain,
      water,
      roads,
      roadEnvironment,
    }),
  );
}
