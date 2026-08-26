import type { MobilitySnapshotV1 } from '@web-three-city/citizen-mobility-core';
import {
  applyRouteRecovery,
  createTrafficProjection,
  createTrafficSnapshot,
  createTrafficSnapshotV2,
  deriveBuildingAccessNodes,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  recoverInvalidatedRoute,
  type ActiveTransportTripV2,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceProjection,
  type TrafficGraph,
  type TrafficSnapshotV1,
  type TrafficSnapshotV2,
} from '@web-three-city/traffic-core';

function withBuildingRevision(graph: TrafficGraph, buildingRevision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: buildingRevision });
}

function v1TrafficView(traffic: TrafficSnapshotV1 | TrafficSnapshotV2): TrafficSnapshotV1 {
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

function restoreV2Traffic(
  original: TrafficSnapshotV2,
  recovered: TrafficSnapshotV1,
): TrafficSnapshotV2 {
  const originalByTripId = new Map(
    original.activeTrips.map((trip) => [trip.tripId, trip] as const),
  );
  const activeTrips: ActiveTransportTripV2[] = recovered.activeTrips.map((trip) => {
    const originalTrip = originalByTripId.get(trip.tripId);
    if (originalTrip === undefined) return trip as unknown as ActiveTransportTripV2;
    const { queuedMovement, ...withoutQueue } = trip;
    return {
      ...withoutQueue,
      queuedMovement:
        queuedMovement === null
          ? null
          : {
              fromEdgeId: queuedMovement.fromEdgeId,
              toEdgeId: queuedMovement.toEdgeId,
              arrivedAtTransportSecond: queuedMovement.arrivedAtGameSecond * 4,
            },
      driveMovementPhase: originalTrip.driveMovementPhase,
      entryReservationResourceIds: Object.freeze([]),
    };
  });
  return createTrafficSnapshotV2({
    schemaVersion: 2,
    revision: recovered.revision,
    policyVersion: recovered.policyVersion,
    graphSourceRoadRevision: recovered.graphSourceRoadRevision,
    graphSourceBuildingRevision: recovered.graphSourceBuildingRevision,
    timeCursor: original.timeCursor,
    activeTrips,
  });
}

export function reconcileTrafficAfterRoadChange(
  input: Readonly<{
    traffic: TrafficSnapshotV1 | TrafficSnapshotV2;
    mobility: MobilitySnapshotV1;
    trafficSourceAfter: Readonly<{
      roads: RoadTrafficSourceProjection;
      buildingAccess: BuildingTrafficAccessProjection;
    }>;
  }>,
): TrafficSnapshotV1 | TrafficSnapshotV2 {
  const traffic = v1TrafficView(input.traffic);
  const buildingRevision = input.trafficSourceAfter.buildingAccess.buildingRevision;
  const vehicleGraph = withBuildingRevision(
    deriveVehicleTrafficGraph(input.trafficSourceAfter.roads),
    buildingRevision,
  );
  const pedestrianGraph = withBuildingRevision(
    derivePedestrianTrafficGraph(input.trafficSourceAfter.roads),
    buildingRevision,
  );
  const access = deriveBuildingAccessNodes(
    input.trafficSourceAfter.buildingAccess,
    vehicleGraph,
    pedestrianGraph,
  );
  const accessByBuilding = new Map(
    access.map((entry) => [entry.buildingInstanceId, entry] as const),
  );
  const previousProjectionGraph: TrafficGraph = Object.freeze({
    sourceRoadRevision: traffic.graphSourceRoadRevision,
    sourceBuildingRevision: traffic.graphSourceBuildingRevision,
    nodes: Object.freeze([...pedestrianGraph.nodes, ...vehicleGraph.nodes]),
    edges: Object.freeze([...pedestrianGraph.edges, ...vehicleGraph.edges]),
  });
  const previousCostField = createTrafficProjection({
    snapshot: createTrafficSnapshot({
      ...traffic,
      graphSourceRoadRevision: input.trafficSourceAfter.roads.roadRevision,
      graphSourceBuildingRevision: buildingRevision,
    }),
    graph: previousProjectionGraph,
  }).nextCostField;
  const mobilityTripById = new Map(
    input.mobility.trips.map((trip) => [trip.tripId, trip] as const),
  );

  const nextTrips = traffic.activeTrips.map((trip) => {
    if (trip.status !== 'Active') return trip;
    const mobilityTrip = mobilityTripById.get(trip.tripId);
    if (mobilityTrip === undefined || mobilityTrip.status !== 'Active') {
      return Object.freeze({ ...trip, status: 'Cancelled' as const, queuedMovement: null });
    }
    const targetAccess = accessByBuilding.get(mobilityTrip.destinationBuildingId);
    const graph = trip.mode === 'Walk' ? pedestrianGraph : vehicleGraph;
    const destinationNodeId =
      targetAccess === undefined
        ? null
        : trip.mode === 'Walk'
          ? targetAccess.walkAccessNodeId
          : targetAccess.driveAccessNodeId;
    const recovery = recoverInvalidatedRoute({
      trip,
      graph,
      request: {
        tripId: trip.tripId,
        lastStableNodeId: trip.lastStableNodeId,
        latestDestinationAccessNodeId: destinationNodeId,
      },
      previousCostField,
    });
    return applyRouteRecovery(trip, recovery, input.trafficSourceAfter.roads.roadRevision);
  });

  const recovered = createTrafficSnapshot({
    ...traffic,
    revision: traffic.revision + 1,
    graphSourceRoadRevision: input.trafficSourceAfter.roads.roadRevision,
    graphSourceBuildingRevision: buildingRevision,
    activeTrips: nextTrips,
  });
  return input.traffic.schemaVersion === 2 ? restoreV2Traffic(input.traffic, recovered) : recovered;
}
