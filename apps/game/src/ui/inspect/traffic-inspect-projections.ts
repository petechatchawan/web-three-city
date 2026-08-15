import type { CommittedWorld } from '../../application/committed-world.js';
import { createPresentCitizenMobilityProjection } from '../../mobility-source-projection.js';
import { createTrafficPresentationSnapshot } from '../../traffic-presentation-projection.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from '../../traffic-source-projection.js';
import type { CitizenInspectTarget, VehicleInspectTarget } from './inspect-target.js';
import type { InspectProjection } from './inspect-projections.js';

function field(label: string, value: string | number): Readonly<{ label: string; value: string }> {
  return Object.freeze({ label, value: String(value) });
}

function activeHouseholdId(world: CommittedWorld, citizenId: string): string | null {
  return (
    world.rci.households.memberships.find(
      (membership) => membership.citizenId === citizenId && membership.endedAtTick === null,
    )?.householdId ?? null
  );
}

function activeEmployment(world: CommittedWorld, citizenId: string): Readonly<{
  employmentAssignmentId: string;
  workplaceId: string;
  workBuildingId: string | null;
}> | null {
  const assignment = world.rci.employment.assignments.find(
    (entry) => entry.citizenId === citizenId && entry.endedAtTick === null,
  );
  if (assignment === undefined) return null;
  const workplace = world.rci.employment.workplaces.find(
    (entry) => entry.workplaceId === assignment.workplaceId && entry.retiredAtTick === null,
  );
  return Object.freeze({
    employmentAssignmentId: assignment.employmentAssignmentId,
    workplaceId: assignment.workplaceId,
    workBuildingId: workplace?.buildingInstanceId ?? null,
  });
}

function mobilityPurposeLabel(value: string | null): string {
  if (value === 'CommuteToWork') return 'Commute to work';
  if (value === 'CommuteHome') return 'Commute home';
  return value ?? 'None';
}

function trafficContext(world: CommittedWorld, tripId: string): Readonly<{
  edgeId: string | null;
  congestionMilli: number | null;
  effectiveTravelSeconds: number | null;
  queued: boolean;
}> {
  const transport = world.traffic.activeTrips.find((trip) => trip.tripId === tripId);
  if (transport === undefined || transport.status !== 'Active') {
    return Object.freeze({
      edgeId: null,
      congestionMilli: null,
      effectiveTravelSeconds: null,
      queued: false,
    });
  }
  const edgeId = transport.routeEdgeIds[transport.segmentIndex] ?? null;
  if (edgeId === null) {
    return Object.freeze({
      edgeId: null,
      congestionMilli: null,
      effectiveTravelSeconds: null,
      queued: transport.queuedMovement !== null,
    });
  }
  const presentation = createTrafficPresentationSnapshot({
    traffic: world.traffic,
    roads: createRoadTrafficSourceProjectionFromEnvironment(world.roads, world.environments.building),
    buildingAccess: createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    ),
  });
  const edge = presentation.edges.find((entry) => entry.edgeId === edgeId);
  return Object.freeze({
    edgeId,
    congestionMilli: edge?.congestionMilli ?? null,
    effectiveTravelSeconds: edge?.effectiveTravelSeconds ?? null,
    queued: transport.queuedMovement !== null,
  });
}

function citizenProjection(
  world: CommittedWorld,
  target: CitizenInspectTarget,
): InspectProjection {
  const citizen = world.rci.population.citizens.find((entry) => entry.citizenId === target.citizenId);
  if (citizen === undefined || citizen.presence !== 'resident') {
    return Object.freeze({ kind: 'unavailable', title: 'Unavailable' });
  }
  const mobilityState = world.mobility.citizenStates.find(
    (state) => state.citizenId === target.citizenId,
  );
  const sources = createPresentCitizenMobilityProjection(
    world.rci,
    world.buildings,
    world.simulation.absoluteTick,
  );
  const source = sources.find((entry) => entry.citizenId === target.citizenId);
  const employment = activeEmployment(world, target.citizenId);
  const trip =
    target.tripId === null
      ? mobilityState?.activeTripId === null || mobilityState?.activeTripId === undefined
        ? null
        : world.mobility.trips.find((entry) => entry.tripId === mobilityState.activeTripId) ?? null
      : world.mobility.trips.find((entry) => entry.tripId === target.tripId) ?? null;
  const traffic = trip === null ? null : trafficContext(world, trip.tripId);
  const fields = [
    field('Citizen ID', target.citizenId),
    field('Household', activeHouseholdId(world, target.citizenId) ?? 'None'),
    field('Home', source?.homeBuildingId ?? 'Unplaced'),
    field('Work', employment?.workBuildingId ?? 'Unemployed'),
    field('Activity', mobilityState?.currentActivity ?? 'Idle'),
  ];
  if (trip !== null) {
    fields.push(
      field('Trip purpose', mobilityPurposeLabel(trip.purpose)),
      field('Travel mode', trip.mode ?? 'Unavailable'),
      field('Destination', trip.destinationBuildingId),
      field('Travel state', traffic?.queued ? 'Queued' : trip.status),
    );
    if (traffic?.effectiveTravelSeconds !== null && traffic?.effectiveTravelSeconds !== undefined) {
      fields.push(field('ETA', `${traffic.effectiveTravelSeconds}s current edge`));
    }
  }
  return Object.freeze({
    kind: 'citizen',
    title: 'Citizen',
    fields: Object.freeze(fields),
  });
}

function vehicleProjection(
  world: CommittedWorld,
  target: VehicleInspectTarget,
): InspectProjection {
  const transport = world.traffic.activeTrips.find(
    (trip) => trip.tripId === target.tripId && trip.citizenId === target.citizenId,
  );
  const mobilityTrip = world.mobility.trips.find(
    (trip) => trip.tripId === target.tripId && trip.citizenId === target.citizenId,
  );
  if (
    transport === undefined ||
    transport.status !== 'Active' ||
    transport.mode !== 'Drive' ||
    mobilityTrip === undefined
  ) {
    return Object.freeze({ kind: 'unavailable', title: 'Unavailable' });
  }
  const traffic = trafficContext(world, target.tripId);
  return Object.freeze({
    kind: 'vehicle',
    title: 'Vehicle',
    fields: Object.freeze([
      field('Citizen ID', target.citizenId),
      field('Trip ID', target.tripId),
      field('Trip purpose', mobilityPurposeLabel(mobilityTrip.purpose)),
      field('Origin', mobilityTrip.originBuildingId),
      field('Destination', mobilityTrip.destinationBuildingId),
      field('Current road', traffic.edgeId ?? 'Unavailable'),
      field('Travel state', traffic.queued ? 'Queued' : 'Moving'),
      field('Congestion', traffic.congestionMilli === null ? 'Unavailable' : `${traffic.congestionMilli}‰`),
      field(
        'ETA',
        traffic.effectiveTravelSeconds === null
          ? 'Unavailable'
          : `${traffic.effectiveTravelSeconds}s current edge`,
      ),
    ]),
  });
}

export function createTrafficInspectProjection(
  world: CommittedWorld,
  target: CitizenInspectTarget | VehicleInspectTarget,
): InspectProjection {
  return target.kind === 'citizen'
    ? citizenProjection(world, target)
    : vehicleProjection(world, target);
}
