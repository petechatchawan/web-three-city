import {
  createBuildingSnapshot,
  type BuildingDevelopmentEnvironment,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  createEmptyMobilitySnapshot,
  createMobilitySnapshot,
  reconcileMobilityCitizens,
  type MobilitySnapshotV1,
} from '@web-three-city/citizen-mobility-core';
import {
  cloneEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
  validateEconomySnapshot,
  type EconomySnapshotV1,
} from '@web-three-city/economy-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import {
  createRoadSnapshot,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import {
  createSimulationSnapshot,
  deriveMacroHourIndex,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import {
  createEmptyTrafficSnapshot,
  createTrafficSnapshot,
  createTrafficSnapshotV2,
  type TrafficSnapshotV1,
} from '@web-three-city/traffic-core';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  createZoneSnapshot,
  type ZonePlacementEnvironment,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from '../building-development-environment.js';
import { createBuildingWorldOccupancy } from '../building-world-occupancy.js';
import { createPresentCitizenMobilityProjection } from '../mobility-source-projection.js';
import {
  recallMobilityTrafficState,
  rememberMobilityTrafficState,
} from '../mobility-traffic-state-registry.js';
import { createRoadPlacementEnvironment } from '../road-placement-environment.js';
import { reconcileTrafficAfterRoadChange } from '../traffic-road-reconciliation.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from '../traffic-source-projection.js';
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
  readonly economy: EconomySnapshotV1;
  readonly mobility: MobilitySnapshotV1;
  readonly traffic: TrafficSnapshotV1;
  readonly environments: Readonly<{
    readonly road: RoadPlacementEnvironment;
    readonly zone: ZonePlacementEnvironment;
    readonly building: BuildingDevelopmentEnvironment;
  }>;
}

export type CommittedWorldInput = Omit<CommittedWorld, 'mobility' | 'traffic'> &
  Readonly<{
    mobility?: MobilitySnapshotV1;
    traffic?: TrafficSnapshotV1;
  }>;

type CompleteCommittedWorldInput = Omit<CommittedWorld, never>;

export interface CommittedWorldCreationOptions {
  /**
   * Reuse static authority and derived environments for a transport-only
   * publication. Domain revisions are the invalidation boundary for these
   * immutable snapshots; dynamic Mobility/Traffic state is still cloned.
   */
  readonly reuseStaticFrom?: CommittedWorld;
  /**
   * Internal transaction-only reuse for already immutable dynamic snapshots.
   * Public publication continues to defensively clone these subtrees.
   */
  readonly reuseDynamicFrom?: CommittedWorld;
}

function assertApplicationRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new RangeError('committed-world:invalid-revision');
}

function completeCommittedMobilityTraffic(input: CommittedWorldInput): CompleteCommittedWorldInput {
  const recalled = recallMobilityTrafficState(input.rci);
  const mobility = input.mobility ?? recalled?.mobility ?? createEmptyMobilitySnapshot();
  const recalledTraffic = recalled?.traffic;
  const traffic =
    input.traffic ??
    (recalledTraffic !== undefined &&
    recalledTraffic.graphSourceRoadRevision === input.roads.revision &&
    recalledTraffic.graphSourceBuildingRevision === input.buildings.revision
      ? recalledTraffic
      : createEmptyTrafficSnapshot({
          roadRevision: input.roads.revision,
          buildingRevision: input.buildings.revision,
        }));
  return Object.freeze({ ...input, mobility, traffic });
}

function assertEnvironmentProvenance(input: CompleteCommittedWorldInput): void {
  const { terrain, water, roads, zones, buildings, environments, traffic } = input;
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
    environments.building.zoneRevision === zones.revision &&
    traffic.graphSourceRoadRevision === roads.revision &&
    traffic.graphSourceBuildingRevision === buildings.revision;
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
  const pendingMobilityTraffic = recallMobilityTrafficState(world.rci);
  const clone = createCommittedWorld(world);
  const readWorld = Object.freeze({
    ...clone,
    roads: world.roads,
    environments: Object.freeze({
      ...clone.environments,
      building: world.environments.building,
    }),
  });
  if (pendingMobilityTraffic !== null) {
    rememberMobilityTrafficState(
      world.rci,
      pendingMobilityTraffic.mobility,
      pendingMobilityTraffic.traffic,
    );
  }
  return readWorld;
}

export function createCommittedWorld(
  input: CommittedWorldInput,
  options: CommittedWorldCreationOptions = {},
): CommittedWorld {
  const complete = completeCommittedMobilityTraffic(input);
  assertApplicationRevision(complete.revision);
  assertEnvironmentProvenance(complete);
  if (!validateEconomySnapshot(complete.economy, FOUNDATION_ECONOMY_RULES)) {
    throw new RangeError('committed-world:invalid-economy');
  }
  const reusable = options.reuseStaticFrom;
  const dynamicReusable = options.reuseDynamicFrom;
  const reuseStatic =
    reusable !== undefined &&
    complete.terrain === reusable.terrain &&
    complete.water === reusable.water &&
    complete.roads === reusable.roads &&
    complete.zones === reusable.zones &&
    complete.buildings === reusable.buildings &&
    complete.terrain.revision === reusable.terrain.revision &&
    complete.water.sourceTerrainRevision === reusable.water.sourceTerrainRevision &&
    complete.roads.revision === reusable.roads.revision &&
    complete.zones.revision === reusable.zones.revision &&
    complete.buildings.revision === reusable.buildings.revision;
  const terrain = reuseStatic
    ? reusable.terrain
    : createTerrainMap({
        config: WORLD_CONFIG,
        heightLevels: complete.terrain.heightLevels,
        seed: complete.terrain.seed,
        generatorVersion: complete.terrain.generatorVersion,
        generationAttempt: complete.terrain.generationAttempt,
        revision: complete.terrain.revision,
      });
  const water = reuseStatic ? reusable.water : cloneWaterSnapshot(complete.water);
  const roads = reuseStatic
    ? reusable.roads
    : createRoadSnapshot(
        {
          width: complete.roads.width,
          height: complete.roads.height,
          revision: complete.roads.revision,
          definitionCodes: complete.roads.definitionCodes,
        },
        WORLD_CONFIG,
      );
  const zones = reuseStatic
    ? reusable.zones
    : createZoneSnapshot(
        {
          width: complete.zones.width,
          height: complete.zones.height,
          revision: complete.zones.revision,
          definitionCodes: complete.zones.definitionCodes,
        },
        WORLD_CONFIG,
      );
  const buildings = reuseStatic
    ? reusable.buildings
    : createBuildingSnapshot(
        { revision: complete.buildings.revision, instances: complete.buildings.instances },
        WORLD_CONFIG,
      );
  const reuseDynamic =
    dynamicReusable !== undefined &&
    complete.simulation === dynamicReusable.simulation &&
    complete.economy === dynamicReusable.economy &&
    complete.mobility === dynamicReusable.mobility &&
    complete.traffic === dynamicReusable.traffic;
  const simulation = reuseDynamic
    ? dynamicReusable.simulation
    : createSimulationSnapshot(complete.simulation);
  const mobility = createMobilitySnapshot(complete.mobility);
  // Traffic V2 is introduced at the Game transaction seam ahead of the Save-schema cutover.
  // Keep the declared application compatibility shape until the later persistence migration.
  const traffic =
    (complete.traffic as { schemaVersion: number }).schemaVersion === 2
      ? (createTrafficSnapshotV2(complete.traffic as never) as unknown as TrafficSnapshotV1)
      : createTrafficSnapshot(complete.traffic);
  const environments = reuseStatic
    ? reusable.environments
    : Object.freeze({
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
  const world = Object.freeze({
    revision: complete.revision,
    terrain,
    water,
    roads,
    zones,
    buildings,
    simulation,
    rci: complete.rci,
    economy: reuseDynamic ? dynamicReusable.economy : cloneEconomySnapshot(complete.economy),
    mobility: reuseDynamic ? dynamicReusable.mobility : mobility,
    traffic: reuseDynamic ? dynamicReusable.traffic : traffic,
    environments,
  });
  rememberMobilityTrafficState(world.rci, world.mobility, world.traffic);
  return world;
}

export class CommittedWorldStore {
  #world: CommittedWorld;

  constructor(initialWorld: CommittedWorldInput) {
    this.#world = createCommittedWorld(initialWorld);
  }

  snapshot(): CommittedWorld {
    return cloneForRead(this.#world);
  }

  /** Internal coordinator read; callers must not expose or mutate this object. */
  committedForTransaction(): CommittedWorld {
    return this.#world;
  }

  /** Internal coordinator commit for an already defensively-created candidate. */
  replacePrepared(expectedRevision: number, next: CommittedWorld): void {
    if (expectedRevision !== this.#world.revision)
      throw new Error('committed-world:stale-revision');
    if (next.revision !== this.#world.revision + 1)
      throw new Error('committed-world:invalid-next-revision');
    this.#world = next;
  }

  replacePreparedBatch(expectedRevision: number, candidates: readonly CommittedWorld[]): void {
    if (candidates.length === 0) throw new Error('committed-world:empty-batch');
    if (expectedRevision !== this.#world.revision)
      throw new Error('committed-world:stale-revision');
    let revision = expectedRevision;
    for (const candidate of candidates) {
      revision += 1;
      if (candidate.revision !== revision) throw new Error('committed-world:invalid-batch');
    }
    this.#world = candidates[candidates.length - 1]!;
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
  economy: EconomySnapshotV1;
  mobility?: MobilitySnapshotV1;
  traffic?: TrafficSnapshotV1;
}>;

function requiresTrafficReconciliation(
  traffic: TrafficSnapshotV1,
  mobility: MobilitySnapshotV1,
  roads: RoadSnapshot,
  buildings: BuildingSnapshot,
): boolean {
  if (
    traffic.graphSourceRoadRevision !== roads.revision ||
    traffic.graphSourceBuildingRevision !== buildings.revision
  ) {
    return true;
  }
  const activeMobilityTripIds = new Set(
    mobility.trips.filter((trip) => trip.status === 'Active').map((trip) => trip.tripId),
  );
  return traffic.activeTrips.some(
    (trip) => trip.status === 'Active' && !activeMobilityTripIds.has(trip.tripId),
  );
}

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

  const recalled = recallMobilityTrafficState(input.rci);
  let mobility = input.mobility ?? recalled?.mobility ?? createEmptyMobilitySnapshot();
  if (input.mobility === undefined) {
    mobility = reconcileMobilityCitizens({
      snapshot: mobility,
      citizens: createPresentCitizenMobilityProjection(
        input.rci,
        input.buildings,
        deriveMacroHourIndex(input.simulation.absoluteGameMinute),
      ),
    }).snapshot;
  }

  let traffic =
    input.traffic ??
    recalled?.traffic ??
    createEmptyTrafficSnapshot({
      roadRevision: input.roads.revision,
      buildingRevision: input.buildings.revision,
    });

  if (requiresTrafficReconciliation(traffic, mobility, input.roads, input.buildings)) {
    traffic = reconcileTrafficAfterRoadChange({
      traffic,
      mobility,
      trafficSourceAfter: Object.freeze({
        roads: createRoadTrafficSourceProjectionFromEnvironment(input.roads, environments.building),
        buildingAccess: createBuildingTrafficAccessProjection(
          input.buildings,
          input.roads,
          environments.building,
        ),
      }),
    }) as TrafficSnapshotV1;
  }

  rememberMobilityTrafficState(input.rci, mobility, traffic);
  return createCommittedWorld({
    ...input,
    mobility,
    traffic,
    water: waterResult.value,
    environments,
  });
}
