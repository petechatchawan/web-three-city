import {
  createBuildingSnapshot,
  type BuildingDevelopmentEnvironment,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  createRoadSnapshot,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import { createSimulationSnapshot, type SimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  createZoneSnapshot,
  type ZonePlacementEnvironment,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from '../building-development-environment.js';
import { createBuildingWorldOccupancy } from '../building-world-occupancy.js';
import { createRoadPlacementEnvironment } from '../road-placement-environment.js';
import { createZonePlacementEnvironment } from '../zone-placement-environment.js';

export interface CommittedWorld {
  readonly revision: number;
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly zones: ZoneSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly rci: RciSnapshot;
  readonly environments: Readonly<{
    readonly road: RoadPlacementEnvironment;
    readonly zone: ZonePlacementEnvironment;
    readonly building: BuildingDevelopmentEnvironment;
  }>;
}

export type CommittedWorldInput = Readonly<{
  revision: number;
  terrain: TerrainSnapshot;
  water: WaterSnapshot;
  roads: RoadSnapshot;
  zones: ZoneSnapshot;
  buildings: BuildingSnapshot;
  simulation: SimulationSnapshot;
  rci: RciSnapshot;
  environments: CommittedWorld['environments'];
}>;

function assertApplicationRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new RangeError('committed-world:invalid-revision');
}

function assertEnvironmentProvenance(input: CommittedWorldInput): void {
  const { terrain, water, roads, zones, buildings, environments } = input;
  const coherent =
    water.sourceTerrainRevision === terrain.revision &&
    water.sourceTerrainSeed === terrain.seed &&
    environments.road.terrainRevision === terrain.revision &&
    environments.road.waterSourceTerrainRevision === water.sourceTerrainRevision &&
    environments.zone.terrainRevision === terrain.revision &&
    environments.zone.waterSourceTerrainRevision === water.sourceTerrainRevision &&
    environments.zone.roadRevision === roads.revision &&
    environments.zone.occupancyRevision === buildings.revision &&
    environments.building.terrainRevision === terrain.revision &&
    environments.building.waterSourceTerrainRevision === water.sourceTerrainRevision &&
    environments.building.roadRevision === roads.revision &&
    environments.building.zoneRevision === zones.revision;
  if (!coherent) throw new RangeError('committed-world:invalid-environment-provenance');
}

function cloneWaterSnapshot(input: WaterSnapshot): WaterSnapshot {
  if (input.width !== WORLD_CONFIG.mapWidth || input.height !== WORLD_CONFIG.mapHeight) {
    throw new RangeError('committed-world:invalid-water-dimensions');
  }
  return Object.freeze({
    schemaVersion: input.schemaVersion,
    policyVersion: input.policyVersion,
    width: input.width,
    height: input.height,
    seaLevel: input.seaLevel,
    sourceTerrainRevision: input.sourceTerrainRevision,
    sourceTerrainSeed: input.sourceTerrainSeed,
    seaTriangleMask: input.seaTriangleMask.slice(),
    seaTriangleCount: input.seaTriangleCount,
    enclosedWetTriangleCount: input.enclosedWetTriangleCount,
    shorelineSegmentCount: input.shorelineSegmentCount,
  });
}

function cloneForRead(world: CommittedWorld): CommittedWorld {
  return createCommittedWorld(world);
}

export function createCommittedWorld(input: CommittedWorldInput): CommittedWorld {
  assertApplicationRevision(input.revision);
  assertEnvironmentProvenance(input);
  const terrain = createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: input.terrain.heightLevels,
    seed: input.terrain.seed,
    generatorVersion: input.terrain.generatorVersion,
    generationAttempt: input.terrain.generationAttempt,
    revision: input.terrain.revision,
  });
  const water = cloneWaterSnapshot(input.water);
  const roads = createRoadSnapshot(
    {
      width: input.roads.width,
      height: input.roads.height,
      revision: input.roads.revision,
      definitionCodes: input.roads.definitionCodes,
    },
    WORLD_CONFIG,
  );
  const zones = createZoneSnapshot(
    {
      width: input.zones.width,
      height: input.zones.height,
      revision: input.zones.revision,
      definitionCodes: input.zones.definitionCodes,
    },
    WORLD_CONFIG,
  );
  const buildings = createBuildingSnapshot(
    { revision: input.buildings.revision, instances: input.buildings.instances },
    WORLD_CONFIG,
  );
  const simulation = createSimulationSnapshot(input.simulation);
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(terrain, water, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      terrain,
      water,
      roads,
      createBuildingWorldOccupancy(buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(terrain, water, roads, zones, WORLD_CONFIG),
  });
  return Object.freeze({
    revision: input.revision,
    terrain,
    water,
    roads,
    zones,
    buildings,
    simulation,
    rci: input.rci,
    environments,
  });
}

export class CommittedWorldStore {
  #world: CommittedWorld;
  constructor(initialWorld: CommittedWorldInput) {
    this.#world = createCommittedWorld(initialWorld);
  }
  snapshot(): CommittedWorld {
    return cloneForRead(this.#world);
  }
  replace(expectedRevision: number, next: CommittedWorldInput): CommittedWorld {
    if (expectedRevision !== this.#world.revision)
      throw new Error('committed-world:stale-revision');
    if (next.revision !== this.#world.revision + 1)
      throw new Error('committed-world:invalid-next-revision');
    this.#world = createCommittedWorld(next);
    return this.snapshot();
  }
}

export type CommittedDomainState = Readonly<{
  revision: number;
  terrain: TerrainSnapshot;
  roads: RoadSnapshot;
  zones: ZoneSnapshot;
  buildings: BuildingSnapshot;
  simulation: SimulationSnapshot;
  rci: RciSnapshot;
}>;

export function createCommittedWorldFromDomainState(input: CommittedDomainState): CommittedWorld {
  const waterResult = deriveWaterSnapshot(input.terrain, WORLD_CONFIG);
  if (!waterResult.ok)
    throw new Error(`committed-world:water-derivation:${waterResult.error.code}`);
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(input.terrain, waterResult.value, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      input.terrain,
      waterResult.value,
      input.roads,
      createBuildingWorldOccupancy(input.buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(
      input.terrain,
      waterResult.value,
      input.roads,
      input.zones,
      WORLD_CONFIG,
    ),
  });
  return createCommittedWorld({
    ...input,
    water: waterResult.value,
    environments,
  });
}
