import {
  createEmptyMobilitySnapshot,
  createMobilitySnapshot,
  type CitizenMobilityState,
  type MobilityTrip,
} from '@web-three-city/citizen-mobility-core';
import {
  createInitialRciSnapshot,
  createRciSnapshot,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import { BASIC_ROAD_CODE, createRoadSnapshot } from '@web-three-city/road-core';
import {
  createTrafficSnapshot,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type ActiveTransportTrip,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createCommittedWorldFromDomainState } from './application/committed-world.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';
import { encodeWorldSaveV7, type WorldSaveV7 } from './world-save.js';

export const TRAFFIC_PERFORMANCE_LOGICAL_CITIZENS = 5_000;
export const TRAFFIC_PERFORMANCE_LOGICAL_TRIPS = 5_000;

export interface TrafficPerformanceReleaseFixture {
  readonly save: WorldSaveV7;
  readonly citizenCount: number;
  readonly activeTripCount: number;
  readonly focusCell: Readonly<{ x: number; z: number }>;
}

function roadIndex(x: number, z: number): number {
  return z * WORLD_CONFIG.mapWidth + x;
}

function performanceRoads(base: ReturnType<typeof createTrafficReleaseFixture>['world']['roads']) {
  const codes = base.definitionCodes;
  for (let z = 4; z < WORLD_CONFIG.mapHeight - 2; z += 8) {
    for (let x = 2; x < WORLD_CONFIG.mapWidth - 2; x += 1) {
      codes[roadIndex(x, z)] = BASIC_ROAD_CODE;
    }
  }
  for (let x = 4; x < WORLD_CONFIG.mapWidth - 2; x += 16) {
    for (let z = 2; z < WORLD_CONFIG.mapHeight - 2; z += 1) {
      codes[roadIndex(x, z)] = BASIC_ROAD_CODE;
    }
  }
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: base.revision + 1,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function performanceRci(
  base: ReturnType<typeof createTrafficReleaseFixture>['world'],
): RciSnapshot {
  const initial = createInitialRciSnapshot({
    absoluteTick: base.simulation.absoluteTick,
    deterministicSeed: 20260816,
  });
  const citizens = Array.from({ length: TRAFFIC_PERFORMANCE_LOGICAL_CITIZENS }, (_, index) => ({
    citizenId: `citizen:${index + 1}`,
    presence: 'resident' as const,
    sexDefinitionId: index % 2 === 0 ? 'sex.female' : 'sex.male',
    bornAtTick: 0,
    movedIntoCityAtTick: 0,
    movedOutOfCityAtTick: null,
    diedAtTick: null,
  }));
  return createRciSnapshot(
    {
      ...initial,
      revision: 1,
      population: {
        revision: 1,
        citizens,
        qualifications: Object.freeze([]),
      },
      households: {
        revision: 1,
        households: Object.freeze([
          Object.freeze({ householdId: 'household:1', foundedAtTick: 0, dissolvedAtTick: null }),
        ]),
        memberships: citizens.map((citizen, index) =>
          Object.freeze({
            membershipId: `household-membership:${index + 1}`,
            householdId: 'household:1',
            citizenId: citizen.citizenId,
            startedAtTick: 0,
            endedAtTick: null,
            endReasonDefinitionId: null,
          }),
        ),
      },
      sequences: {
        ...initial.sequences,
        nextCitizen: TRAFFIC_PERFORMANCE_LOGICAL_CITIZENS + 1,
        nextHousehold: 2,
        nextHouseholdMembership: TRAFFIC_PERFORMANCE_LOGICAL_CITIZENS + 1,
      },
    },
    {
      buildings: base.buildings,
      simulation: base.simulation,
      registries: (awaitlessRegistries()),
    },
  );
}

function awaitlessRegistries() {
  // Kept local so performance fixture construction has no registry mutation surface.
  return requireFoundationRegistries();
}

function requireFoundationRegistries() {
  // Dynamic helper is replaced at module initialization below to keep fixture code deterministic.
  return foundationRegistries;
}

import { createFoundationRciRegistries } from '@web-three-city/rci-core';
const foundationRegistries = createFoundationRciRegistries();

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

export function createTrafficPerformanceReleaseFixture(): TrafficPerformanceReleaseFixture {
  const baseFixture = createTrafficReleaseFixture();
  const base = baseFixture.world;
  const roads = performanceRoads(base.roads);
  const graphWorld = createCommittedWorldFromDomainState({
    revision: 0,
    terrain: base.terrain,
    roads,
    zones: base.zones,
    buildings: base.buildings,
    simulation: base.simulation,
    rci: base.rci,
    economy: base.economy,
    mobility: base.mobility,
    traffic: createTrafficSnapshot({
      schemaVersion: 1,
      revision: 0,
      policyVersion: 1,
      graphSourceRoadRevision: roads.revision,
      graphSourceBuildingRevision: base.buildings.revision,
      activeTrips: Object.freeze([]),
    }),
  });
  const source = createRoadTrafficSourceProjectionFromEnvironment(
    graphWorld.roads,
    graphWorld.environments.building,
  );
  const access = createBuildingTrafficAccessProjection(
    graphWorld.buildings,
    graphWorld.roads,
    graphWorld.environments.building,
  );
  const walk = withBuildingRevision(derivePedestrianTrafficGraph(source), access.buildingRevision);
  const drive = withBuildingRevision(deriveVehicleTrafficGraph(source), access.buildingRevision);
  if (walk.edges.length === 0 || drive.edges.length === 0) {
    throw new Error('traffic-performance-fixture:empty-graph');
  }

  const rci = performanceRci(graphWorld);
  const mobilityBase = createEmptyMobilitySnapshot();
  const citizenStates: CitizenMobilityState[] = [];
  const mobilityTrips: MobilityTrip[] = [];
  const trafficTrips: ActiveTransportTrip[] = [];
  for (let index = 0; index < TRAFFIC_PERFORMANCE_LOGICAL_TRIPS; index += 1) {
    const citizenId = `citizen:${index + 1}`;
    const tripId = `trip:${index + 1}`;
    const mode = index % 2 === 0 ? ('Walk' as const) : ('Drive' as const);
    const graph = mode === 'Walk' ? walk : drive;
    const edge = graph.edges[index % graph.edges.length]!;
    const originBuildingId = 'fixture:home:1';
    const destinationBuildingId = mode === 'Walk' ? 'fixture:work:shop' : 'fixture:work:factory';
    citizenStates.push(
      Object.freeze({
        citizenId,
        currentActivity: 'Travel',
        stationaryBuildingId: null,
        activeTripId: tripId,
        scheduleCursorDay: 0,
        nextBoundaryGameMinute: null,
      }),
    );
    mobilityTrips.push(
      Object.freeze({
        tripId,
        citizenId,
        purpose: 'CommuteToWork',
        originBuildingId,
        destinationBuildingId,
        mode,
        departureGameMinute: 420 + (index % 121),
        status: 'Active',
        failureReason: null,
      }),
    );
    trafficTrips.push(
      Object.freeze({
        tripId,
        citizenId,
        mode,
        originBuildingId,
        destinationBuildingId,
        routeEdgeIds: Object.freeze([edge.edgeId]),
        routeGraphRevision: roads.revision,
        segmentIndex: 0,
        progressQ: (index * 104_729) % 1_000_000,
        lastStableNodeId: edge.fromNodeId,
        queuedMovement: null,
        status: 'Active',
        failureReason: null,
      }),
    );
  }
  const mobility = createMobilitySnapshot({
    ...mobilityBase,
    revision: 1,
    nextTripSequence: TRAFFIC_PERFORMANCE_LOGICAL_TRIPS + 1,
    citizenStates,
    trips: mobilityTrips,
  });
  const traffic = createTrafficSnapshot({
    schemaVersion: 1,
    revision: 1,
    policyVersion: 1,
    graphSourceRoadRevision: roads.revision,
    graphSourceBuildingRevision: base.buildings.revision,
    activeTrips: trafficTrips,
  });
  const world = createCommittedWorldFromDomainState({
    revision: 0,
    terrain: base.terrain,
    roads,
    zones: base.zones,
    buildings: base.buildings,
    simulation: base.simulation,
    rci,
    economy: base.economy,
    mobility,
    traffic,
  });
  return Object.freeze({
    save: encodeWorldSaveV7(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      world.simulation,
      world.rci,
      world.economy,
      world.mobility,
      world.traffic,
    ),
    citizenCount: TRAFFIC_PERFORMANCE_LOGICAL_CITIZENS,
    activeTripCount: TRAFFIC_PERFORMANCE_LOGICAL_TRIPS,
    focusCell: Object.freeze({ x: 16, z: 20 }),
  });
}
