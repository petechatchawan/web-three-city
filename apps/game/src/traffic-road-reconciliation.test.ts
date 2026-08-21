import {
  commitPlannedMobilityTrip,
  formatMobilityTripId,
  type MobilityModeCandidate,
  type MobilityTripPlanningRequest,
} from '@web-three-city/citizen-mobility-core';
import {
  createActiveTransportTrip,
  createTrafficSnapshot,
  createTrafficSnapshotV2,
  deriveBuildingAccessNodes,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  planModeCandidates,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import {
  ARTERIAL_ROAD_CODE,
  BASIC_ROAD_CODE,
  COLLECTOR_ROAD_CODE,
  ROAD_EAST,
  ROAD_WEST,
  createRoadSnapshot,
} from '@web-three-city/road-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import { reconcileTrafficAfterRoadChange } from './traffic-road-reconciliation.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

function activeDriveState() {
  const fixture = createTrafficReleaseFixture();
  const world = fixture.world;
  const citizenId = fixture.summary.driveCitizenIds[0]!;
  const originBuildingId = fixture.summary.homeBuildingByCitizen[citizenId]!;
  const destinationBuildingId = fixture.summary.workBuildingByCitizen[citizenId]!;
  const tripId = formatMobilityTripId(world.mobility.nextTripSequence);
  const roadSource = createRoadTrafficSourceProjectionFromEnvironment(
    world.roads,
    world.environments.building,
  );
  const buildingAccess = createBuildingTrafficAccessProjection(
    world.buildings,
    world.roads,
    world.environments.building,
  );
  const vehicleGraph = withBuildingRevision(
    deriveVehicleTrafficGraph(roadSource),
    buildingAccess.buildingRevision,
  );
  const pedestrianGraph = withBuildingRevision(
    derivePedestrianTrafficGraph(roadSource),
    buildingAccess.buildingRevision,
  );
  const access = deriveBuildingAccessNodes(buildingAccess, vehicleGraph, pedestrianGraph);
  const origin = access.find((entry) => entry.buildingInstanceId === originBuildingId)!;
  const destination = access.find((entry) => entry.buildingInstanceId === destinationBuildingId)!;
  const candidates = planModeCandidates({
    requestTripId: tripId,
    citizenId,
    originWalkAccessNodeId: origin.walkAccessNodeId,
    destinationWalkAccessNodeId: destination.walkAccessNodeId,
    originDriveAccessNodeId: origin.driveAccessNodeId,
    destinationDriveAccessNodeId: destination.driveAccessNodeId,
    pedestrianGraph,
    vehicleGraph,
  });
  const drive = candidates.find((candidate) => candidate.mode === 'Drive')!;
  expect(drive.available).toBe(true);
  const request: MobilityTripPlanningRequest = Object.freeze({
    tripId,
    citizenId,
    purpose: 'CommuteToWork',
    originBuildingId,
    destinationBuildingId,
    departureGameMinute: fixture.summary.departureGameMinutes[citizenId]!,
  });
  const driveOnly: readonly MobilityModeCandidate[] = Object.freeze([
    Object.freeze({
      mode: 'Drive' as const,
      available: true,
      generalizedCostSeconds: drive.generalizedCostSeconds,
    }),
  ]);
  const mobility = commitPlannedMobilityTrip({
    snapshot: world.mobility,
    request,
    candidates: driveOnly,
  });
  const trip = createActiveTransportTrip({
    tripId: request.tripId,
    citizenId,
    originBuildingId,
    destinationBuildingId,
    route: drive,
    graph: vehicleGraph,
    routeGraphRevision: world.roads.revision,
  });
  const traffic = createTrafficSnapshot({
    ...world.traffic,
    revision: world.traffic.revision + 1,
    activeTrips: Object.freeze([trip]),
  });
  return { fixture, mobility, traffic, trip };
}

function roadsWithout(cells: readonly CellCoord[], revision: number) {
  const fixture = createTrafficReleaseFixture();
  const codes = fixture.world.roads.definitionCodes;
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = 0;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function sourceAfter(
  fixture: ReturnType<typeof createTrafficReleaseFixture>,
  roads: ReturnType<typeof roadsWithout>,
) {
  const environment = createBuildingDevelopmentEnvironment(
    fixture.world.terrain,
    fixture.world.water,
    roads,
    fixture.world.zones,
    WORLD_CONFIG,
  );
  return Object.freeze({
    roads: createRoadTrafficSourceProjectionFromEnvironment(roads, environment),
    buildingAccess: createBuildingTrafficAccessProjection(
      fixture.world.buildings,
      roads,
      environment,
    ),
  });
}

function assertMixedRoadTypesProjectAsConnectedTrafficOccupancy(): void {
  const definitionCodes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  const indexOf = (x: number, z: number) => z * WORLD_CONFIG.mapWidth + x;
  definitionCodes[indexOf(1, 1)] = BASIC_ROAD_CODE;
  definitionCodes[indexOf(2, 1)] = COLLECTOR_ROAD_CODE;
  definitionCodes[indexOf(3, 1)] = ARTERIAL_ROAD_CODE;
  const roads = createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 7,
      definitionCodes,
    },
    WORLD_CONFIG,
  );
  const flatEnvironment = {
    surfaceAt: () => ({ minimumLevel: 0, maximumLevel: 0 }),
  } as unknown as Parameters<typeof createRoadTrafficSourceProjectionFromEnvironment>[1];

  const projection = createRoadTrafficSourceProjectionFromEnvironment(roads, flatEnvironment);
  const cells = projection.cells.filter((cell) => cell.z === 1 && cell.x >= 1 && cell.x <= 3);

  expect(
    cells.map((cell) => ({
      definitionCode: cell.definitionCode,
      connectionMask: cell.connectionMask,
    })),
  ).toEqual([
    { definitionCode: BASIC_ROAD_CODE, connectionMask: ROAD_EAST },
    {
      definitionCode: COLLECTOR_ROAD_CODE,
      connectionMask: ROAD_EAST | ROAD_WEST,
    },
    { definitionCode: ARTERIAL_ROAD_CODE, connectionMask: ROAD_WEST },
  ]);
}

describe('Traffic reconciliation after committed Road changes', () => {
  it('preserves an active Drive identity across a definition-only Road upgrade', () => {
    const state = activeDriveState();
    const definitionCodes = new Uint8Array(state.fixture.world.roads.definitionCodes);
    const upgrade = state.fixture.summary.alternateRouteCells[0]!;
    definitionCodes[upgrade.z * WORLD_CONFIG.mapWidth + upgrade.x] = ARTERIAL_ROAD_CODE;
    const roadsAfter = createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 2,
        definitionCodes,
      },
      WORLD_CONFIG,
    );

    const reconciled = reconcileTrafficAfterRoadChange({
      traffic: state.traffic,
      mobility: state.mobility,
      trafficSourceAfter: sourceAfter(state.fixture, roadsAfter),
    });

    expect(reconciled.activeTrips[0]).toMatchObject({
      tripId: state.trip.tripId,
      citizenId: state.trip.citizenId,
      status: 'Active',
      routeEdgeIds: state.trip.routeEdgeIds,
    });
  });

  it('reconciles V2 Traffic without downgrading the transport cursor or lifecycle phase', () => {
    const state = activeDriveState();
    const v2 = createTrafficSnapshotV2({
      schemaVersion: 2,
      revision: state.traffic.revision,
      policyVersion: 1,
      graphSourceRoadRevision: state.traffic.graphSourceRoadRevision,
      graphSourceBuildingRevision: state.traffic.graphSourceBuildingRevision,
      timeCursor: {
        sourceGameMinute: 540,
        completedTransportQuantaWithinMinute: 2,
        absoluteTransportSecond: 2_162,
        temporalPolicyVersion: 1,
      },
      activeTrips: [
        {
          ...state.trip,
          queuedMovement:
            state.trip.queuedMovement === null
              ? null
              : {
                  fromEdgeId: state.trip.queuedMovement.fromEdgeId,
                  toEdgeId: state.trip.queuedMovement.toEdgeId,
                  arrivedAtTransportSecond: state.trip.queuedMovement.arrivedAtGameSecond * 4,
                },
          driveMovementPhase: 'Travelling',
          entryReservationResourceIds: Object.freeze(['entry:home']),
        },
      ],
    });
    const roadsAfter = roadsWithout([state.fixture.summary.primaryRoadCutCell], 2);

    const reconciled = reconcileTrafficAfterRoadChange({
      traffic: v2,
      mobility: state.mobility,
      trafficSourceAfter: sourceAfter(state.fixture, roadsAfter),
    });

    expect(reconciled.schemaVersion).toBe(2);
    if (reconciled.schemaVersion !== 2) return;
    expect(reconciled.timeCursor).toEqual(v2.timeCursor);
    expect(reconciled.activeTrips[0]).toMatchObject({
      tripId: state.trip.tripId,
      driveMovementPhase: 'Travelling',
      entryReservationResourceIds: [],
    });
  });

  it('recovers an active Drive trip through the deterministic alternate corridor', () => {
    assertMixedRoadTypesProjectAsConnectedTrafficOccupancy();

    const state = activeDriveState();
    const roadsAfter = roadsWithout([state.fixture.summary.primaryRoadCutCell], 2);
    const reconciled = reconcileTrafficAfterRoadChange({
      traffic: state.traffic,
      mobility: state.mobility,
      trafficSourceAfter: sourceAfter(state.fixture, roadsAfter),
    });
    const trip = reconciled.activeTrips[0]!;
    expect(trip.status).toBe('Active');
    expect(trip.routeGraphRevision).toBe(roadsAfter.revision);
    expect(trip.routeEdgeIds).not.toEqual(state.trip.routeEdgeIds);
    expect(trip.citizenId).toBe(state.trip.citizenId);
    expect(
      state.fixture.world.rci.population.citizens.some(
        (citizen) => citizen.citizenId === trip.citizenId,
      ),
    ).toBe(true);
  });

  it('fails only the Traffic trip when both primary and alternate paths are disconnected', () => {
    const state = activeDriveState();
    const blocked = [
      state.fixture.summary.primaryRoadCutCell,
      ...state.fixture.summary.alternateRouteCells,
    ];
    const roadsAfter = roadsWithout(blocked, 2);
    const reconciled = reconcileTrafficAfterRoadChange({
      traffic: state.traffic,
      mobility: state.mobility,
      trafficSourceAfter: sourceAfter(state.fixture, roadsAfter),
    });
    const trip = reconciled.activeTrips[0]!;
    expect(trip.status).toBe('Failed');
    expect(trip.failureReason).toBe('UnreachableDestination');
    expect(state.mobility.trips.find((candidate) => candidate.tripId === trip.tripId)?.status).toBe(
      'Active',
    );
    expect(
      state.fixture.world.rci.population.citizens.some(
        (citizen) => citizen.citizenId === trip.citizenId,
      ),
    ).toBe(true);
  });
});
