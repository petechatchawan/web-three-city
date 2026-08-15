import {
  compareTrafficId,
  type BuildingAccessNodePair,
  type BuildingTrafficAccessProjection,
  type TrafficCardinalDirection,
  type TrafficGraph,
} from './contracts.js';
import { driveNodeId } from './vehicle-graph.js';
import { walkSideNodeId } from './pedestrian-graph.js';

function nearestWalkSide(frontageDirection: TrafficCardinalDirection): TrafficCardinalDirection {
  return frontageDirection === 'N'
    ? 'S'
    : frontageDirection === 'E'
      ? 'W'
      : frontageDirection === 'S'
        ? 'N'
        : 'E';
}

export function deriveBuildingAccessNodes(
  buildings: BuildingTrafficAccessProjection,
  vehicleGraph: TrafficGraph,
  pedestrianGraph: TrafficGraph,
): readonly BuildingAccessNodePair[] {
  const vehicleNodes = new Set(vehicleGraph.nodes.map((node) => node.nodeId));
  const pedestrianNodes = new Set(pedestrianGraph.nodes.map((node) => node.nodeId));
  const result: BuildingAccessNodePair[] = [];
  const seen = new Set<string>();

  for (const access of [...buildings.accesses].sort((a, b) =>
    compareTrafficId(a.buildingInstanceId, b.buildingInstanceId),
  )) {
    if (seen.has(access.buildingInstanceId)) continue;
    seen.add(access.buildingInstanceId);
    const driveAccessNodeId = driveNodeId(access.frontageRoadX, access.frontageRoadZ);
    const walkAccessNodeId = walkSideNodeId(
      access.frontageRoadX,
      access.frontageRoadZ,
      nearestWalkSide(access.frontageDirection),
    );
    if (!vehicleNodes.has(driveAccessNodeId) || !pedestrianNodes.has(walkAccessNodeId)) continue;
    result.push(
      Object.freeze({
        buildingInstanceId: access.buildingInstanceId,
        walkAccessNodeId,
        driveAccessNodeId,
      }),
    );
  }

  return Object.freeze(result);
}
