import {
  buildingDefinitionForId,
  createEmptyBuildingSnapshot,
  decodeBuildingSaveV1,
  decodeBuildingSaveV2,
  encodeBuildingSaveV1,
  encodeBuildingSaveV2,
  occupiedCellsForBuilding,
  resolveBuildingFrontage,
  type BuildingSaveV1,
  type BuildingSaveV2,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
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
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
  decodeSimulationSaveV1,
  encodeSimulationSaveV1,
  type SimulationSaveV1,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
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
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import { createBuildingWorldOccupancy } from './building-world-occupancy.js';
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
export interface WorldSaveV3 {
  readonly kind: 'world-save';
  readonly schemaVersion: 3;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
  readonly zones: ZoneSaveV1;
  readonly buildings: BuildingSaveV1;
}
export interface WorldSaveV4 {
  readonly kind: 'world-save';
  readonly schemaVersion: 4;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
  readonly zones: ZoneSaveV1;
  readonly buildings: BuildingSaveV2;
  readonly simulation: SimulationSaveV1;
}

export interface DecodedWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly roadEnvironment: RoadPlacementEnvironment;
  readonly zones: ZoneSnapshot;
  readonly zoneEnvironment: ZonePlacementEnvironment;
  readonly buildings: BuildingSnapshot;
  readonly buildingEnvironment: ReturnType<typeof createBuildingDevelopmentEnvironment>;
  readonly simulation: SimulationSnapshot;
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
  | 'world-save:invalid-zone-placement'
  | 'world-save:invalid-buildings'
  | 'world-save:invalid-building-environment'
  | 'world-save:invalid-building-placement'
  | 'world-save:invalid-simulation'
  | 'world-save:invalid-building-lifecycle';

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
    kind: 'world-save',
    schemaVersion: 1,
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
    kind: 'world-save',
    schemaVersion: 2,
    terrain: encodeTerrainSaveV1(terrain),
    roads: encodeRoadSaveV1(roads),
    zones: encodeZoneSaveV1(zones),
  });
}

export function encodeWorldSaveV3(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
  buildings: BuildingSnapshot,
): WorldSaveV3 {
  return Object.freeze({
    kind: 'world-save',
    schemaVersion: 3,
    terrain: encodeTerrainSaveV1(terrain),
    roads: encodeRoadSaveV1(roads),
    zones: encodeZoneSaveV1(zones),
    buildings: encodeBuildingSaveV1(buildings),
  });
}

export function encodeWorldSaveV4(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
): WorldSaveV4 {
  return Object.freeze({
    kind: 'world-save',
    schemaVersion: 4,
    terrain: encodeTerrainSaveV1(terrain),
    roads: encodeRoadSaveV1(roads),
    zones: encodeZoneSaveV1(zones),
    buildings: encodeBuildingSaveV2(buildings),
    simulation: encodeSimulationSaveV1(simulation),
  });
}

export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError> {
  let terrainInput: unknown = input;
  let roadInput: unknown = null;
  let zoneInput: unknown = null;
  let buildingInput: unknown = null;
  let simulationInput: unknown = null;
  let schemaVersion: 0 | 1 | 2 | 3 | 4 = 0;

  if (isWorldEnvelope(input)) {
    if (
      input.kind !== 'world-save' ||
      ![1, 2, 3, 4].includes(input.schemaVersion as number) ||
      !('terrain' in input) ||
      !('roads' in input)
    ) {
      return err({ code: 'world-save:invalid-schema' });
    }
    schemaVersion = input.schemaVersion as 1 | 2 | 3 | 4;
    if (
      (schemaVersion >= 2 && !('zones' in input)) ||
      (schemaVersion >= 3 && !('buildings' in input)) ||
      (schemaVersion === 4 && !('simulation' in input))
    ) {
      return err({ code: 'world-save:invalid-schema' });
    }
    terrainInput = input.terrain;
    roadInput = input.roads;
    zoneInput = schemaVersion >= 2 ? input.zones : null;
    buildingInput = schemaVersion >= 3 ? input.buildings : null;
    simulationInput = schemaVersion === 4 ? input.simulation : null;
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
    const result = decodeRoadSaveV1(roadInput, config);
    if (!result.ok) {
      return err({
        code: 'world-save:invalid-roads',
        details: Object.freeze({ roadCode: result.error.code }),
      });
    }
    roads = result.value;
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
    const result = decodeZoneSaveV1(zoneInput, config);
    if (!result.ok) {
      return err({
        code: 'world-save:invalid-zones',
        details: Object.freeze({ zoneCode: result.error.code }),
      });
    }
    zones = result.value;
  }

  const emptyOccupancy = Object.freeze({ revision: 0, isBlocked: () => false });
  let validationZoneEnvironment: ZonePlacementEnvironment;
  try {
    validationZoneEnvironment = createZonePlacementEnvironment(
      terrain,
      water,
      roads,
      emptyOccupancy,
      config,
    );
  } catch {
    return err({ code: 'world-save:invalid-zone-environment' });
  }
  for (let z = 0; z < config.mapHeight; z += 1) {
    for (let x = 0; x < config.mapWidth; x += 1) {
      const cell = { x, z };
      if (!zoneOccupiedAt(zones, cell)) continue;
      const reason = zoneCellPolicyInvalidReason(zones, cell, validationZoneEnvironment, config);
      if (reason !== null) {
        return err({
          code: 'world-save:invalid-zone-placement',
          details: Object.freeze({ reason, cell: Object.freeze(cell) }),
        });
      }
    }
  }

  let buildings: BuildingSnapshot;
  if (schemaVersion < 3) {
    buildings = createEmptyBuildingSnapshot(config);
  } else {
    const result =
      schemaVersion === 4
        ? decodeBuildingSaveV2(buildingInput, config)
        : decodeBuildingSaveV1(buildingInput, config);
    if (!result.ok) {
      return err({
        code: 'world-save:invalid-buildings',
        details: Object.freeze({ buildingCode: result.error.code }),
      });
    }
    buildings = result.value;
  }

  let simulation: SimulationSnapshot;
  if (schemaVersion === 4) {
    const result = decodeSimulationSaveV1(simulationInput);
    if (!result.ok) {
      return err({
        code: 'world-save:invalid-simulation',
        details: Object.freeze({ simulationCode: result.error.code }),
      });
    }
    simulation = result.value;
  } else {
    const initial = createInitialSimulationSnapshot();
    simulation = createSimulationSnapshot({
      revision: initial.revision,
      absoluteTick: initial.absoluteTick,
      growthSequence: buildings.instances.length,
    });
  }

  for (const instance of buildings.instances) {
    if (
      instance.lifecycle === 'construction' &&
      instance.constructionCompletesAtTick <= simulation.absoluteTick
    ) {
      return err({
        code: 'world-save:invalid-building-lifecycle',
        details: Object.freeze({ instanceId: instance.instanceId }),
      });
    }
  }

  let buildingEnvironment: ReturnType<typeof createBuildingDevelopmentEnvironment>;
  try {
    buildingEnvironment = createBuildingDevelopmentEnvironment(
      terrain,
      water,
      roads,
      zones,
      config,
    );
  } catch {
    return err({ code: 'world-save:invalid-building-environment' });
  }
  try {
    for (const instance of buildings.instances) {
      const definition = buildingDefinitionForId(instance.buildingDefinitionId);
      const cells = occupiedCellsForBuilding(instance);
      const firstCell = cells[0];
      const zoneId =
        firstCell === undefined ? null : buildingEnvironment.zoneDefinitionIdAt(firstCell);
      const invalid =
        zoneId === null ||
        !definition.compatibleZoneDefinitionIds.includes(zoneId) ||
        cells.some(
          (cell) =>
            buildingEnvironment.zoneDefinitionIdAt(cell) !== zoneId ||
            !buildingEnvironment.isDry(cell) ||
            buildingEnvironment.surfaceAt(cell).shape !== 'flat' ||
            buildingEnvironment.isRoadOccupied(cell),
        ) ||
        resolveBuildingFrontage(instance, buildingEnvironment) === null;
      if (invalid) {
        return err({
          code: 'world-save:invalid-building-placement',
          details: Object.freeze({ instanceId: instance.instanceId }),
        });
      }
    }
  } catch {
    return err({ code: 'world-save:invalid-building-placement' });
  }

  let zoneEnvironment: ZonePlacementEnvironment;
  try {
    zoneEnvironment = createZonePlacementEnvironment(
      terrain,
      water,
      roads,
      createBuildingWorldOccupancy(buildings),
      config,
    );
  } catch {
    return err({ code: 'world-save:invalid-zone-environment' });
  }

  return ok(
    Object.freeze({
      terrain,
      water,
      roads,
      roadEnvironment,
      zones,
      zoneEnvironment,
      buildings,
      buildingEnvironment,
      simulation,
    }),
  );
}
