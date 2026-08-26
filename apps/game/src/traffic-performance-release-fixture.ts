import {
  createEmptyMobilitySnapshot,
  createMobilitySnapshot,
  type CitizenMobilityState,
  type MobilityTrip,
} from '@web-three-city/citizen-mobility-core';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  createRciSnapshot,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import { BASIC_ROAD_CODE, createRoadSnapshot } from '@web-three-city/road-core';
import {
  createTrafficSnapshot,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  planTransportRoute,
  type ActiveTransportTrip,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { deriveMacroHourIndex } from '@web-three-city/simulation-core';
import { createCommittedWorldFromDomainState } from './application/committed-world.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';
import { encodeWorldSaveV7, type WorldSaveV7 } from './world-save.js';

export const TRAFFIC_PERFORMANCE_LOGICAL_CITIZENS = 5_000;
export const TRAFFIC_PERFORMANCE_LOGICAL_TRIPS = 5_000;

const FOUNDATION_RCI_REGISTRIES = createFoundationRciRegistries();
const MINIMUM_REMAINING_PERFORMANCE_ROUTE_EDGES = 81;
const PERFORMANCE_ROUTE_SEED_LIMIT = 64;

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
    absoluteTick: deriveMacroHourIndex(base.simulation.absoluteGameMinute),
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
      registries: FOUNDATION_RCI_REGISTRIES,
    },
  );
}

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

function createPerformanceRouteResolver(
  graph: TrafficGraph,
): (edgeId: string) => readonly string[] | null {
  const cache = new Map<string, readonly string[] | null>();
  const edgesById = new Map(graph.edges.map((edge) => [edge.edgeId, edge] as const));
  const outgoing = new Map<string, TrafficGraph['edges'][number][]>();
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.fromNodeId) ?? [];
    list.push(edge);
    outgoing.set(edge.fromNodeId, list);
  }
  for (const list of outgoing.values()) {
    list.sort((first, second) =>
      first.edgeId < second.edgeId ? -1 : first.edgeId > second.edgeId ? 1 : 0,
    );
  }

  // Keep the fixture tied to the real route planner while using a bounded
  // deterministic continuation walk for every seeded edge. Calling the
  // planner once per dense-graph edge makes fixture construction dominate the
  // browser test itself without adding authority coverage.
  const anchor = graph.nodes[0];
  const destination = [...graph.nodes].sort((first, second) =>
    first.nodeId < second.nodeId ? -1 : first.nodeId > second.nodeId ? 1 : 0,
  )[graph.nodes.length - 1];
  if (anchor === undefined || destination === undefined) {
    throw new Error('traffic-performance-fixture:missing-route-anchor');
  }
  const plannerProbe = planTransportRoute(graph, {
    requestTripId: `fixture:planner-probe:${graph.edges[0]?.mode ?? 'Walk'}`,
    citizenId: 'fixture:planner-probe',
    mode: graph.edges[0]?.mode ?? 'Walk',
    originAccessNodeId: anchor.nodeId,
    destinationAccessNodeId: destination.nodeId,
  });
  if (!plannerProbe.available) throw new Error('traffic-performance-fixture:planner-probe-failed');

  return (edgeId: string): readonly string[] | null => {
    const cached = cache.get(edgeId);
    if (cached !== undefined) return cached;
    const edge = edgesById.get(edgeId);
    if (edge === undefined) throw new Error(`traffic-performance-fixture:missing-edge:${edgeId}`);
    const route: string[] = [edge.edgeId];
    let currentNodeId = edge.toNodeId;
    let previousNodeId = edge.fromNodeId;
    while (route.length < MINIMUM_REMAINING_PERFORMANCE_ROUTE_EDGES + 1) {
      const choices = outgoing
        .get(currentNodeId)
        ?.filter((candidate) => candidate.mode === edge.mode);
      if (choices === undefined || choices.length === 0) {
        cache.set(edgeId, null);
        return null;
      }
      const next =
        choices.find(
          (candidate) => candidate.edgeId !== route.at(-1) && candidate.toNodeId !== previousNodeId,
        ) ?? choices.find((candidate) => candidate.toNodeId !== previousNodeId);
      if (next === undefined) {
        cache.set(edgeId, null);
        return null;
      }
      route.push(next.edgeId);
      previousNodeId = currentNodeId;
      currentNodeId = next.toNodeId;
    }
    const resolved = Object.freeze(route);
    cache.set(edgeId, resolved);
    return resolved;
  };
}

interface PerformanceRouteSeed {
  readonly edge: TrafficGraph['edges'][number];
  readonly route: readonly string[];
}

function collectPerformanceRouteSeeds(
  graph: TrafficGraph,
  routeForEdge: (edgeId: string) => readonly string[] | null,
): readonly PerformanceRouteSeed[] {
  const seeds: PerformanceRouteSeed[] = [];
  for (const edge of graph.edges) {
    const route = routeForEdge(edge.edgeId);
    if (route === null) continue;
    seeds.push(Object.freeze({ edge, route }));
    if (seeds.length === PERFORMANCE_ROUTE_SEED_LIMIT) break;
  }
  return Object.freeze(seeds);
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
  const walkRouteForEdge = createPerformanceRouteResolver(walk);
  const driveRouteForEdge = createPerformanceRouteResolver(drive);
  const walkSeeds = collectPerformanceRouteSeeds(walk, walkRouteForEdge);
  const driveSeeds = collectPerformanceRouteSeeds(drive, driveRouteForEdge);
  if (walkSeeds.length === 0 || driveSeeds.length === 0) {
    throw new Error('traffic-performance-fixture:no-long-route-seeds');
  }
  for (let index = 0; index < TRAFFIC_PERFORMANCE_LOGICAL_TRIPS; index += 1) {
    const citizenId = `citizen:${index + 1}`;
    const tripId = `trip:${index + 1}`;
    const mode = index % 2 === 0 ? ('Walk' as const) : ('Drive' as const);
    const seeds = mode === 'Walk' ? walkSeeds : driveSeeds;
    const seed = seeds[index % seeds.length]!;
    const edge = seed.edge;
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
        routeEdgeIds: seed.route,
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
