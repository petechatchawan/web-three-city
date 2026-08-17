import {
  commitPlannedMobilityTrip,
  formatMobilityTripId,
  type MobilityModeCandidate,
  type MobilityTripPlanningRequest,
} from '@web-three-city/citizen-mobility-core';
import {
  createActiveTransportTrip,
  createTrafficSnapshot,
  deriveBuildingAccessNodes,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  planModeCandidates,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import { createCommittedWorldFromDomainState } from './application/committed-world.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';
import { encodeWorldSaveV7, type WorldSaveV7 } from './world-save.js';

export interface TrafficRecoveryReleaseFixture {
  readonly save: WorldSaveV7;
  readonly citizenId: string;
  readonly tripId: string;
  readonly routeEdgeIds: readonly string[];
  readonly primaryRoadCutCell: Readonly<{ x: number; z: number }>;
}

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

export function createTrafficRecoveryReleaseFixture(): TrafficRecoveryReleaseFixture {
  const base = createTrafficReleaseFixture();
  const world = base.world;
  const citizenId = base.summary.driveCitizenIds[0]!;
  const originBuildingId = base.summary.homeBuildingByCitizen[citizenId]!;
  const destinationBuildingId = base.summary.workBuildingByCitizen[citizenId]!;
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
  const origin = access.find((entry) => entry.buildingInstanceId === originBuildingId);
  const destination = access.find((entry) => entry.buildingInstanceId === destinationBuildingId);
  if (origin === undefined || destination === undefined) {
    throw new Error('traffic-recovery-fixture:missing-building-access');
  }
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
  const drive = candidates.find((candidate) => candidate.mode === 'Drive');
  if (drive === undefined || !drive.available || drive.generalizedCostSeconds === null) {
    throw new Error('traffic-recovery-fixture:drive-route-unavailable');
  }
  const request: MobilityTripPlanningRequest = Object.freeze({
    tripId,
    citizenId,
    purpose: 'CommuteToWork',
    originBuildingId,
    destinationBuildingId,
    departureGameMinute: base.summary.departureGameMinutes[citizenId]!,
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
  const activeTrip = createActiveTransportTrip({
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
    activeTrips: Object.freeze([activeTrip]),
  });
  const activeWorld = createCommittedWorldFromDomainState({
    revision: 0,
    terrain: world.terrain,
    roads: world.roads,
    zones: world.zones,
    buildings: world.buildings,
    simulation: world.simulation,
    rci: world.rci,
    economy: world.economy,
    mobility,
    traffic,
  });
  return Object.freeze({
    save: encodeWorldSaveV7(
      activeWorld.terrain,
      activeWorld.roads,
      activeWorld.zones,
      activeWorld.buildings,
      activeWorld.simulation,
      activeWorld.rci,
      activeWorld.economy,
      activeWorld.mobility,
      activeWorld.traffic,
    ),
    citizenId,
    tripId: activeTrip.tripId,
    routeEdgeIds: Object.freeze([...activeTrip.routeEdgeIds]),
    primaryRoadCutCell: base.summary.primaryRoadCutCell,
  });
}
