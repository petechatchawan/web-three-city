import {
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type RoadTrafficSourceProjection,
  type TrafficGraph,
} from '@web-three-city/traffic-core';

export interface TrafficModeGraphs {
  readonly vehicle: TrafficGraph;
  readonly pedestrian: TrafficGraph;
  readonly combined: TrafficGraph;
}

export type TrafficModeGraphDeriver = (roads: RoadTrafficSourceProjection) => TrafficGraph;

export interface TrafficModeGraphProvider {
  get(roads: RoadTrafficSourceProjection, buildingRevision: number): TrafficModeGraphs;
}

function withBuildingRevision(graph: TrafficGraph, buildingRevision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: buildingRevision });
}

export function combineTrafficGraphs(
  pedestrian: TrafficGraph,
  vehicle: TrafficGraph,
): TrafficGraph {
  const nodes = new Map(
    [...pedestrian.nodes, ...vehicle.nodes].map((node) => [node.nodeId, node] as const),
  );
  return Object.freeze({
    sourceRoadRevision: vehicle.sourceRoadRevision,
    sourceBuildingRevision: vehicle.sourceBuildingRevision,
    nodes: Object.freeze(
      [...nodes.values()].sort((first, second) =>
        first.nodeId < second.nodeId ? -1 : first.nodeId > second.nodeId ? 1 : 0,
      ),
    ),
    edges: Object.freeze(
      [...pedestrian.edges, ...vehicle.edges].sort((first, second) =>
        first.edgeId < second.edgeId ? -1 : first.edgeId > second.edgeId ? 1 : 0,
      ),
    ),
  });
}

export function createTrafficModeGraphProvider(
  deriveVehicle: TrafficModeGraphDeriver = deriveVehicleTrafficGraph,
  derivePedestrian: TrafficModeGraphDeriver = derivePedestrianTrafficGraph,
): TrafficModeGraphProvider {
  let cachedRoads: RoadTrafficSourceProjection | null = null;
  let cachedBuildingRevision: number | null = null;
  let cachedVehicle: TrafficGraph | null = null;
  let cachedPedestrian: TrafficGraph | null = null;
  let cachedGraphs: TrafficModeGraphs | null = null;

  return Object.freeze({
    get(roads: RoadTrafficSourceProjection, buildingRevision: number): TrafficModeGraphs {
      if (
        cachedGraphs !== null &&
        cachedRoads === roads &&
        cachedBuildingRevision === buildingRevision
      ) {
        return cachedGraphs;
      }
      const vehicle =
        cachedRoads === roads && cachedVehicle !== null
          ? withBuildingRevision(cachedVehicle, buildingRevision)
          : withBuildingRevision(deriveVehicle(roads), buildingRevision);
      const pedestrian =
        cachedRoads === roads && cachedPedestrian !== null
          ? withBuildingRevision(cachedPedestrian, buildingRevision)
          : withBuildingRevision(derivePedestrian(roads), buildingRevision);
      const graphs = Object.freeze({
        vehicle,
        pedestrian,
        combined: combineTrafficGraphs(pedestrian, vehicle),
      });
      cachedRoads = roads;
      cachedBuildingRevision = buildingRevision;
      cachedVehicle = vehicle;
      cachedPedestrian = pedestrian;
      cachedGraphs = graphs;
      return graphs;
    },
  });
}
