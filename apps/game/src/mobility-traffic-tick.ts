import {
  chooseMobilityMode,
  collectDueMobilityBoundaries,
  commitPlannedMobilityTrip,
  planMobilityBoundaries,
  reconcileMobilityCitizens,
  settleMobilityTrip,
  type MobilitySnapshotV1,
  type PresentCitizenMobilityProjection,
} from '@web-three-city/citizen-mobility-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import {
  advanceTrafficSnapshot,
  cancelTransportTrip,
  createActiveTransportTrip,
  createTrafficProjection,
  createTrafficSnapshot,
  deriveBuildingAccessNodes,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  planModeCandidates,
  type ActiveTransportTrip,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceProjection,
  type TrafficGraph,
  type TrafficSnapshotV1,
} from '@web-three-city/traffic-core';

export interface MobilityTrafficTickResult {
  readonly mobility: MobilitySnapshotV1;
  readonly traffic: TrafficSnapshotV1;
  readonly mobilityReceipts: readonly Readonly<Record<string, unknown>>[];
  readonly trafficReceipts: readonly Readonly<Record<string, unknown>>[];
}

function withBuildingRevision(graph: TrafficGraph, buildingRevision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: buildingRevision });
}

function combinedGraph(walk: TrafficGraph, drive: TrafficGraph): TrafficGraph {
  const nodes = new Map([...walk.nodes, ...drive.nodes].map((node) => [node.nodeId, node] as const));
  return Object.freeze({
    sourceRoadRevision: drive.sourceRoadRevision,
    sourceBuildingRevision: drive.sourceBuildingRevision,
    nodes: Object.freeze(
      [...nodes.values()].sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0)),
    ),
    edges: Object.freeze(
      [...walk.edges, ...drive.edges].sort((a, b) => (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0)),
    ),
  });
}

function settleTerminalTraffic(
  mobility: MobilitySnapshotV1,
  traffic: TrafficSnapshotV1,
): Readonly<{ mobility: MobilitySnapshotV1; traffic: TrafficSnapshotV1 }> {
  let nextMobility = mobility;
  const retained: ActiveTransportTrip[] = [];
  for (const trip of traffic.activeTrips) {
    if (trip.status === 'Active') {
      retained.push(trip);
      continue;
    }
    const mobilityTrip = nextMobility.trips.find((candidate) => candidate.tripId === trip.tripId);
    if (mobilityTrip?.status === 'Active') {
      nextMobility = settleMobilityTrip({
        snapshot: nextMobility,
        tripId: trip.tripId,
        outcome:
          trip.status === 'Arrived'
            ? 'Arrived'
            : trip.status === 'Cancelled'
              ? 'Cancelled'
              : 'Failed',
      });
    }
  }
  return Object.freeze({
    mobility: nextMobility,
    traffic: createTrafficSnapshot({ ...traffic, activeTrips: retained }),
  });
}

export function planMobilityTrafficTick(input: Readonly<{
  mobilityBefore: MobilitySnapshotV1;
  trafficBefore: TrafficSnapshotV1;
  citizensAfter: readonly PresentCitizenMobilityProjection[];
  simulationBefore: SimulationSnapshot;
  simulationAfter: SimulationSnapshot;
  trafficSource: Readonly<{
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
  }>;
}>): MobilityTrafficTickResult {
  if (input.simulationAfter.absoluteTick < input.simulationBefore.absoluteTick) {
    throw new RangeError('mobility-traffic-tick:time-regressed');
  }
  if (input.simulationAfter.absoluteTick === input.simulationBefore.absoluteTick) {
    return Object.freeze({
      mobility: input.mobilityBefore,
      traffic: input.trafficBefore,
      mobilityReceipts: Object.freeze([]),
      trafficReceipts: Object.freeze([]),
    });
  }

  const buildingRevision = input.trafficSource.buildingAccess.buildingRevision;
  const vehicleGraph = withBuildingRevision(
    deriveVehicleTrafficGraph(input.trafficSource.roads),
    buildingRevision,
  );
  const pedestrianGraph = withBuildingRevision(
    derivePedestrianTrafficGraph(input.trafficSource.roads),
    buildingRevision,
  );
  const transportGraph = combinedGraph(pedestrianGraph, vehicleGraph);
  const accessPairs = deriveBuildingAccessNodes(
    input.trafficSource.buildingAccess,
    vehicleGraph,
    pedestrianGraph,
  );
  const accessByBuildingId = new Map(
    accessPairs.map((access) => [access.buildingInstanceId, access] as const),
  );

  const rebasedTrafficBefore = createTrafficSnapshot({
    ...input.trafficBefore,
    graphSourceRoadRevision: input.trafficSource.roads.roadRevision,
    graphSourceBuildingRevision: buildingRevision,
  });
  const previousCostField = createTrafficProjection({
    snapshot: rebasedTrafficBefore,
    graph: transportGraph,
  }).nextCostField;

  const reconciled = reconcileMobilityCitizens({
    snapshot: input.mobilityBefore,
    citizens: input.citizensAfter,
  });
  let mobility = reconciled.snapshot;
  let traffic = createTrafficSnapshot({
    ...rebasedTrafficBefore,
    activeTrips: rebasedTrafficBefore.activeTrips.map((trip) =>
      reconciled.cancelledTripIds.includes(trip.tripId) ? cancelTransportTrip(trip) : trip,
    ),
  });
  ({ mobility, traffic } = settleTerminalTraffic(mobility, traffic));

  const mobilityReceipts: Readonly<Record<string, unknown>>[] = [];
  const trafficReceipts: Readonly<Record<string, unknown>>[] = [];
  const fromMinute = input.simulationBefore.absoluteTick * 60;
  const toMinute = input.simulationAfter.absoluteTick * 60;
  const boundaries = collectDueMobilityBoundaries({
    citizens: input.citizensAfter,
    fromGameMinuteExclusive: fromMinute,
    toGameMinuteInclusive: toMinute,
  });
  const grouped = new Map<number, typeof boundaries>();
  for (const boundary of boundaries) {
    grouped.set(
      boundary.atGameMinute,
      Object.freeze([...(grouped.get(boundary.atGameMinute) ?? []), boundary]),
    );
  }

  let currentGameSecond = fromMinute * 60;
  const targetGameSecond = toMinute * 60;
  const progressUntil = (nextGameSecond: number): void => {
    const elapsedSeconds = nextGameSecond - currentGameSecond;
    if (elapsedSeconds <= 0) return;
    const progressed = advanceTrafficSnapshot({
      snapshot: traffic,
      graph: transportGraph,
      elapsedSeconds,
      intervalStartGameSecond: currentGameSecond,
      costField: previousCostField,
    });
    traffic = progressed.snapshot;
    trafficReceipts.push(Object.freeze({ kind: 'progress', ...progressed.receipt }));
    ({ mobility, traffic } = settleTerminalTraffic(mobility, traffic));
    currentGameSecond = nextGameSecond;
  };

  for (const minute of [...grouped.keys()].sort((a, b) => a - b)) {
    progressUntil(minute * 60);
    const planned = planMobilityBoundaries({
      snapshot: mobility,
      boundaries: grouped.get(minute)!,
      citizens: input.citizensAfter,
    });
    mobilityReceipts.push(
      Object.freeze({
        kind: 'boundary',
        atGameMinute: minute,
        planned: planned.planningRequests.length,
        skipped: planned.skipped.length,
      }),
    );

    for (const request of planned.planningRequests) {
      const origin = accessByBuildingId.get(request.originBuildingId);
      const destination = accessByBuildingId.get(request.destinationBuildingId);
      const candidates =
        origin === undefined || destination === undefined
          ? Object.freeze([
              Object.freeze({
                requestTripId: request.tripId,
                mode: 'Walk' as const,
                available: false,
                generalizedCostSeconds: null,
                routeEdgeIds: Object.freeze([]),
              }),
              Object.freeze({
                requestTripId: request.tripId,
                mode: 'Drive' as const,
                available: false,
                generalizedCostSeconds: null,
                routeEdgeIds: Object.freeze([]),
              }),
            ])
          : planModeCandidates({
              requestTripId: request.tripId,
              citizenId: request.citizenId,
              originWalkAccessNodeId: origin.walkAccessNodeId,
              destinationWalkAccessNodeId: destination.walkAccessNodeId,
              originDriveAccessNodeId: origin.driveAccessNodeId,
              destinationDriveAccessNodeId: destination.driveAccessNodeId,
              pedestrianGraph,
              vehicleGraph,
              previousTrafficCostField: previousCostField,
            });
      const mobilityCandidates = candidates.map((candidate) =>
        Object.freeze({
          mode: candidate.mode,
          available: candidate.available,
          generalizedCostSeconds: candidate.generalizedCostSeconds,
        }),
      );
      const selectedMode = chooseMobilityMode(mobilityCandidates);
      mobility = commitPlannedMobilityTrip({ snapshot: mobility, request, candidates: mobilityCandidates });
      if (selectedMode === null) continue;
      const route = candidates.find((candidate) => candidate.mode === selectedMode)!;
      const active = createActiveTransportTrip({
        tripId: request.tripId,
        citizenId: request.citizenId,
        originBuildingId: request.originBuildingId,
        destinationBuildingId: request.destinationBuildingId,
        route,
        graph: selectedMode === 'Walk' ? pedestrianGraph : vehicleGraph,
        routeGraphRevision: input.trafficSource.roads.roadRevision,
      });
      traffic = createTrafficSnapshot({
        ...traffic,
        revision: traffic.revision + 1,
        activeTrips: [...traffic.activeTrips, active],
      });
    }
  }

  progressUntil(targetGameSecond);
  return Object.freeze({
    mobility,
    traffic,
    mobilityReceipts: Object.freeze(mobilityReceipts),
    trafficReceipts: Object.freeze(trafficReceipts),
  });
}
