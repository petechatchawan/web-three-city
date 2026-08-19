import type { RoadCellView } from '@web-three-city/road-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { buildRoadCellMesh, mergeRoadCellMeshes } from './road-geometry.js';
import { buildRoadLaneMarkingMesh } from './lane-marking-geometry.js';
import type { RoadMeshData } from './road-mesh-data.js';

export function buildRoadPresentationCellMesh(
  view: RoadCellView,
  config: WorldConfig,
): RoadMeshData {
  return mergeRoadCellMeshes([
    buildRoadCellMesh(view, config),
    buildRoadLaneMarkingMesh(view, config),
  ]);
}
