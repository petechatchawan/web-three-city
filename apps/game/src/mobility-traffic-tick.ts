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
  type TrafficSnapshotV2,
} from '@web-three-city/traffic-core';
import type { TrafficModeGraphProvider, TrafficModeGraphs } from './traffic-mode-graph-provider.js';

export interface TrafficJourneyDepartureReceipt extends Readonly<Record<string, unknown>> {
  readonly kind: 'departure';
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly departureGameMinute: number;
  readonly routeEdgeIds: readonly string[];
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
}

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
  const nodes = new Map(
    [...walk.nodes, ...drive.nodes].map((node) => [node.nodeId, node] as const),
  );
  return Object.freeze({
    sourceRoadRevision: drive.sourceRoadRevision,
    sourceBuildingRevision: drive.sourceBuildingRevision,
    nodes: Object.freeze(
      [...nodes.values()].sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0)),
    ),
    edges: Object.freeze(
      [...walk.edges, ...drive.edges].sort((a, b) =>
        a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0,
      ),
    ),
  });
}

function trafficV1View(traffic: TrafficSnapshotV1 | TrafficSnapshotV2): TrafficSnapshotV1 {
  if (traffic.schemaVersion === 1) return createTrafficSnapshot(traffic);
  return createTrafficSnapshot({
    schemaVersion: 1,
    revision: traffic.revision,
    policyVersion: traffic.policyVersion,
    graphSourceRoadRevision: traffic.graphSourceRoadRevision,
    graphSourceBuildingRevision: traffic.graphSourceBuildingRevision,
    activeTrips: traffic.activeTrips.map((trip) => ({
      tripId: trip.tripId,
      citizenId: trip.citizenId,
      mode: trip.mode,
      originBuildingId: trip.originBuildingId,
      destinationBuildingId: trip.destinationBuildingId,
      routeEdgeIds: trip.routeEdgeIds,
      routeGraphRevision: trip.routeGraphRevision,
      segmentIndex: trip.segmentIndex,
      progressQ: trip.progressQ,
      lastStableNodeId: trip.lastStableNodeId,
      queuedMovement:
        trip.queuedMovement === null
          ? null
          : {
              fromEdgeId: trip.queuedMovement.fromEdgeId,
              toEdgeId: trip.queuedMovement.toEdgeId,
              arrivedAtGameSecond: Math.floor(trip.queuedMovement.arrivedAtTransportSecond / 4),
            },
      status: trip.status,
      failureReason: trip.failureReason,
    })),
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

function emptyTickResult(
  mobilityBefore: MobilitySnapshotV1,
  trafficBefore: TrafficSnapshotV1,
  roadRevision: number,
  buildingRevision: number,
): MobilityTrafficTickResult {
  const traffic =
    trafficBefore.graphSourceRoadRevision === roadRevision &&
    trafficBefore.graphSourceBuildingRevision === buildingRevision
      ? trafficBefore
      : createTrafficSnapshot({
          ...trafficBefore,
          graphSourceRoadRevision: roadRevision,
          graphSourceBuildingRevision: buildingRevision,
        });
  return Object.freeze({
    mobility: mobilityBefore,
    traffic,
    mobilityReceipts: Object.freeze([]),
    trafficReceipts: Object.freeze([]),
  });
}

export function isTrafficJourneyDepartureReceipt(
  receipt: Readonly<Record<string, unknown>>,
): receipt is TrafficJourneyDepartureReceipt {
  return (
    receipt.kind === 'departure' &&
    typeof receipt.tripId === 'string' &&
    typeof receipt.citizenId === 'string' &&
    (receipt.mode === 'Walk' || receipt.mode === 'Drive') &&
    Number.isSafeInteger(receipt.departureGameMinute) &&
    Array.isArray(receipt.routeEdgeIds) &&
    receipt.routeEdgeIds.every((edgeId) => typeof edgeId === 'string') &&
    typeof receipt.originBuildingId === 'string' &&
    typeof receipt.destinationBuildingId === 'string'
  );
}

export function planMobilityTrafficTick(
  input: Readonly<{
    mobilityBefore: MobilitySnapshotV1;
    trafficBefore: TrafficSnapshotV1;
    citizensAfter: readonly PresentCitizenMobilityProjection[];
    simulationBefore: SimulationSnapshot;
    simulationAfter: SimulationSnapshot;
    advanceTraffic?: boolean;
    trafficSource: Readonly<{
      roads: RoadTrafficSourceProjection;
      buildingAccess: BuildingTrafficAccessProjection;
    }>;
    trafficGraphs?: TrafficModeGraphs;
    trafficModeGraphProvider?: TrafficModeGraphProvider;
  }>,
): MobilityTrafficTickResult {
  const trafficBefore = trafficV1View(
    input.trafficBefore as unknown as TrafficSnapshotV1 | TrafficSnapshotV2,
  );
  if (input.simulationAfter.absoluteGameMinute < input.simulationBefore.absoluteGameMinute) {
    throw new RangeError('mobility-traffic-tick:time-regressed');
  }
  if (input.simulationAfter.absoluteGameMinute === input.simulationBefore.absoluteGameMinute) {
    return Object.freeze({
      mobility: input.mobilityBefore,
      traffic: trafficBefore,
      mobilityReceipts: Object.freeze([]),
      trafficReceipts: Object.freeze([]),
    });
  }
  if (
    input.citizensAfter.length === 0 &&
    input.mobilityBefore.citizenStates.length === 0 &&
    input.mobilityBefore.trips.length === 0 &&
    trafficBefore.activeTrips.length === 0
  ) {
    return emptyTickResult(
      input.mobilityBefore,
      trafficBefore,
      input.trafficSource.roads.roadRevision,
      input.trafficSource.buildingAccess.buildingRevision,
    );
  }

  const buildingRevision = input.trafficSource.buildingAccess.buildingRevision;
  const trafficGraphs =
    input.trafficGraphs ??
    (input.trafficModeGraphProvider === undefined
      ? undefined
      : input.trafficModeGraphProvider.get(input.trafficSource.roads, buildingRevision));
  const vehicleGraph =
    trafficGraphs?.vehicle ??
    withBuildingRevision(deriveVehicleTrafficGraph(input.trafficSource.roads), buildingRevision);
  const pedestrianGraph =
    trafficGraphs?.pedestrian ??
    withBuildingRevision(derivePedestrianTrafficGraph(input.trafficSource.roads), buildingRevision);
  const transportGraph = trafficGraphs?.combined ?? combinedGraph(pedestrianGraph, vehicleGraph);
  const accessPairs = deriveBuildingAccessNodes(
    input.trafficSource.buildingAccess,
    vehicleGraph,
    pedestrianGraph,
  );
  const accessByBuildingId = new Map(
    accessPairs.map((access) => [access.buildingInstanceId, access] as const),
  );

  const rebasedTrafficBefore = createTrafficSnapshot({
    ...trafficBefore,
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
  const fromMinute = input.simulationBefore.absoluteGameMinute;
  const toMinute = input.simulationAfter.absoluteGameMinute;
  const scheduledBoundaries = collectDueMobilityBoundaries({
    citizens: input.citizensAfter,
    fromGameMinuteExclusive: fromMinute,
    toGameMinuteInclusive: toMinute,
  });
  // A loaded world can begin after one or more schedule boundaries. When the
  // normal interval has no boundary, inspect the current day's schedule from
  // its start and let the one-active-trip checks select only the current
  // desired activity. This is catch-up, not historical trip replay: each
  // citizen can still produce at most one request in this transaction.
  const boundaries =
    scheduledBoundaries.length > 0
      ? scheduledBoundaries
      : (() => {
          const latestDesiredBoundaryByCitizen = new Map<
            string,
            (typeof scheduledBoundaries)[number]
          >();
          for (const boundary of collectDueMobilityBoundaries({
            citizens: input.citizensAfter,
            fromGameMinuteExclusive: -1,
            toGameMinuteInclusive: toMinute,
          })) {
            latestDesiredBoundaryByCitizen.set(boundary.citizenId, boundary);
          }
          return Object.freeze(
            [...latestDesiredBoundaryByCitizen.values()]
              .sort((first, second) => first.citizenId.localeCompare(second.citizenId))
              .map((boundary) => Object.freeze({ ...boundary, atGameMinute: toMinute })),
          );
        })();
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
    if (input.advanceTraffic === false) return;
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
      mobility = commitPlannedMobilityTrip({
        snapshot: mobility,
        request,
        candidates: mobilityCandidates,
      });
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
      trafficReceipts.push(
        Object.freeze({
          kind: 'departure' as const,
          tripId: active.tripId,
          citizenId: active.citizenId,
          mode: active.mode,
          departureGameMinute: request.departureGameMinute,
          routeEdgeIds: Object.freeze([...active.routeEdgeIds]),
          originBuildingId: active.originBuildingId,
          destinationBuildingId: active.destinationBuildingId,
        } satisfies TrafficJourneyDepartureReceipt),
      );
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
