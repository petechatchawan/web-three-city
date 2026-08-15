import type { MobilitySnapshotV1 } from '@web-three-city/citizen-mobility-core';
import {
  applyRouteRecovery,
  createTrafficProjection,
  createTrafficSnapshot,
  deriveBuildingAccessNodes,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  recoverInvalidatedRoute,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceProjection,
  type TrafficGraph,
  type TrafficSnapshotV1,
} from '@web-three-city/traffic-core';

function withBuildingRevision(graph: TrafficGraph, buildingRevision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: buildingRevision });
}

export function reconcileTrafficAfterRoadChange(input: Readonly<{
  traffic: TrafficSnapshotV1;
  mobility: MobilitySnapshotV1;
  trafficSourceAfter: Readonly<{
    roads: RoadTrafficSourceProjection;
    buildingAccess: BuildingTrafficAccessProjection;
  }>;
}>): TrafficSnapshotV1 {
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
  const accessByBuilding = new Map(access.map((entry) => [entry.buildingInstanceId, entry] as const));
  const previousProjectionGraph: TrafficGraph = Object.freeze({
    sourceRoadRevision: input.traffic.graphSourceRoadRevision,
    sourceBuildingRevision: input.traffic.graphSourceBuildingRevision,
    nodes: Object.freeze([...pedestrianGraph.nodes, ...vehicleGraph.nodes]),
    edges: Object.freeze([...pedestrianGraph.edges, ...vehicleGraph.edges]),
  });
  const previousCostField = createTrafficProjection({
    snapshot: createTrafficSnapshot({
      ...input.traffic,
      graphSourceRoadRevision: input.trafficSourceAfter.roads.roadRevision,
      graphSourceBuildingRevision: buildingRevision,
    }),
    graph: previousProjectionGraph,
  }).nextCostField;
  const mobilityTripById = new Map(input.mobility.trips.map((trip) => [trip.tripId, trip] as const));

  const nextTrips = input.traffic.activeTrips.map((trip) => {
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

  return createTrafficSnapshot({
    ...input.traffic,
    revision: input.traffic.revision + 1,
    graphSourceRoadRevision: input.trafficSourceAfter.roads.roadRevision,
    graphSourceBuildingRevision: buildingRevision,
    activeTrips: nextTrips,
  });
}
