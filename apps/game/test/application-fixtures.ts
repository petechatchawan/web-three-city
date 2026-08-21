import {
  createBuildingSnapshot,
  createEmptyBuildingSnapshot,
  type ActiveBuildingInstance,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import {
  createFoundationRciRegistries,
  createRciMigrationInventory,
} from '@web-three-city/rci-core';
import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  COMMERCIAL_ZONE_CODE,
  createEmptyZoneSnapshot,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from '../src/building-development-environment.js';
import { createBuildingWorldOccupancy } from '../src/building-world-occupancy.js';
import { createCommittedWorld, type CommittedWorld } from '../src/application/committed-world.js';
import { createRoadPlacementEnvironment } from '../src/road-placement-environment.js';
import { createZonePlacementEnvironment } from '../src/zone-placement-environment.js';

function terrain() {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
      WORLD_CONFIG.seaLevel + 1,
    ),
    seed: 41,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
  });
}

function commercialBuilding(): ActiveBuildingInstance {
  return Object.freeze({
    instanceId: 'building:commercial:1',
    buildingDefinitionId: 'commercial-shop-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 4, z: 4 }),
    rotationQuarterTurns: 0,
    lifecycle: 'active',
    activatedAtTick: 0,
  });
}

export function createApplicationFixture(
  input: {
    applicationRevision?: number;
    withCommercialBuilding?: boolean;
    buildingRevision?: number;
    withCommercialInfrastructure?: boolean;
  } = {},
): CommittedWorld {
  const applicationRevision = input.applicationRevision ?? 0;
  const withCommercialInfrastructure = input.withCommercialInfrastructure ?? true;
  const terrainSnapshot = terrain();
  const waterResult = deriveWaterSnapshot(terrainSnapshot, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(waterResult.error.code);
  const roadsBase = createEmptyRoadSnapshot(WORLD_CONFIG);
  const roadCodes = roadsBase.definitionCodes.slice();
  if (withCommercialInfrastructure) {
    roadCodes[3 * WORLD_CONFIG.mapWidth + 4] = BASIC_ROAD_CODE;
  }
  const roads: RoadSnapshot = Object.freeze({
    width: roadsBase.width,
    height: roadsBase.height,
    revision: withCommercialInfrastructure ? 1 : roadsBase.revision,
    definitionCodes: roadCodes,
  });
  const zonesBase = createEmptyZoneSnapshot(WORLD_CONFIG);
  const zoneCodes = zonesBase.definitionCodes.slice();
  if (withCommercialInfrastructure) {
    zoneCodes[4 * WORLD_CONFIG.mapWidth + 4] = COMMERCIAL_ZONE_CODE;
  }
  const zones: ZoneSnapshot = Object.freeze({
    width: zonesBase.width,
    height: zonesBase.height,
    revision: withCommercialInfrastructure ? 1 : zonesBase.revision,
    definitionCodes: zoneCodes,
  });
  const buildings: BuildingSnapshot = input.withCommercialBuilding
    ? createBuildingSnapshot(
        { revision: input.buildingRevision ?? 1, instances: [commercialBuilding()] },
        WORLD_CONFIG,
      )
    : createEmptyBuildingSnapshot(WORLD_CONFIG);
  const simulation = createInitialSimulationSnapshot();
  const rci = createRciMigrationInventory({
    buildings,
    absoluteTick: Math.floor(simulation.absoluteGameMinute / 60),
    registries: createFoundationRciRegistries(),
  });
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(terrainSnapshot, waterResult.value, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      terrainSnapshot,
      waterResult.value,
      roads,
      createBuildingWorldOccupancy(buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(
      terrainSnapshot,
      waterResult.value,
      roads,
      zones,
      WORLD_CONFIG,
    ),
  });
  return createCommittedWorld({
    revision: applicationRevision,
    terrain: terrainSnapshot,
    water: waterResult.value,
    roads,
    zones,
    buildings,
    simulation,
    rci,
    economy: createInitialEconomySnapshot(
      {
        year: 1,
        month: 1,
        latestDailySettlementTick: Math.floor(simulation.absoluteGameMinute / 60),
      },
      FOUNDATION_ECONOMY_RULES,
    ),
    environments,
  });
}

export class MemoryWorldStorage {
  readonly values = new Map<string, string>();
  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.values.set(key, value);
  }
}
