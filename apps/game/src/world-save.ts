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
import {
  createEmptyZoneSnapshot,
  decodeZoneSaveV1,
  encodeZoneSaveV1,
  zoneCellPolicyInvalidReason,
  zoneOccupiedAt,
  type ZonePlacementEnvironment,
  type ZoneSaveV1,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import { createRoadPlacementEnvironment } from './road-placement-environment.js';
import { createZonePlacementEnvironment } from './zone-placement-environment.js';

export interface WorldSaveV1 {
  readonly kind: 'world-save';
  readonly schemaVersion: 1;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
}

export interface WorldSaveV2 {
  readonly kind: 'world-save';
  readonly schemaVersion: 2;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
  readonly zones: ZoneSaveV1;
}

export interface DecodedWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly roadEnvironment: RoadPlacementEnvironment;
  readonly zones: ZoneSnapshot;
  readonly zoneEnvironment: ZonePlacementEnvironment;
}

export type WorldSaveErrorCode =
  | 'world-save:invalid-schema'
  | 'world-save:invalid-terrain'
  | 'world-save:invalid-water'
  | 'world-save:invalid-roads'
  | 'world-save:invalid-road-environment'
  | 'world-save:invalid-road-placement'
  | 'world-save:invalid-zones'
  | 'world-save:invalid-zone-environment'
  | 'world-save:invalid-zone-placement';

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

export function encodeWorldSaveV1(terrain: TerrainSnapshot, roads: RoadSnapshot): WorldSaveV1 {
  return Object.freeze({
    kind: 'world-save' as const,
    schemaVersion: 1 as const,
    terrain: encodeTerrainSaveV1(terrain),
    roads: encodeRoadSaveV1(roads),
  });
}

export function encodeWorldSaveV2(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
): WorldSaveV2 {
  return Object.freeze({
    kind: 'world-save' as const,
    schemaVersion: 2 as const,
    terrain: encodeTerrainSaveV1(terrain),
    roads: encodeRoadSaveV1(roads),
    zones: encodeZoneSaveV1(zones),
  });
}

export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError> {
  let terrainInput: unknown = input;
  let roadInput: unknown = null;
  let zoneInput: unknown = null;
  let schemaVersion: 0 | 1 | 2 = 0;

  if (isWorldEnvelope(input)) {
    if (
      input.kind !== 'world-save' ||
      (input.schemaVersion !== 1 && input.schemaVersion !== 2) ||
      !('terrain' in input) ||
      !('roads' in input) ||
      (input.schemaVersion === 2 && !('zones' in input))
    ) {
      return err({ code: 'world-save:invalid-schema' });
    }
    terrainInput = input.terrain;
    roadInput = input.roads;
    zoneInput = input.schemaVersion === 2 ? input.zones : null;
    schemaVersion = input.schemaVersion;
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
  if (schemaVersion === 0) {
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

  let zones: ZoneSnapshot;
  if (schemaVersion < 2) {
    zones = createEmptyZoneSnapshot(config);
  } else {
    const zoneResult = decodeZoneSaveV1(zoneInput, config);
    if (!zoneResult.ok) {
      return err({
        code: 'world-save:invalid-zones',
        details: Object.freeze({ zoneCode: zoneResult.error.code }),
      });
    }
    zones = zoneResult.value;
  }

  let zoneEnvironment: ZonePlacementEnvironment;
  try {
    zoneEnvironment = createZonePlacementEnvironment(
      terrain,
      water,
      roads,
      Object.freeze({ revision: 0, isBlocked: () => false }),
      config,
    );
  } catch {
    return err({ code: 'world-save:invalid-zone-environment' });
  }

  for (let z = 0; z < config.mapHeight; z += 1) {
    for (let x = 0; x < config.mapWidth; x += 1) {
      const cell = { x, z };
      if (!zoneOccupiedAt(zones, cell)) continue;
      const reason = zoneCellPolicyInvalidReason(zones, cell, zoneEnvironment, config);
      if (reason !== null) {
        return err({
          code: 'world-save:invalid-zone-placement',
          details: Object.freeze({ reason, cell: Object.freeze(cell) }),
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
      zones,
      zoneEnvironment,
    }),
  );
}
