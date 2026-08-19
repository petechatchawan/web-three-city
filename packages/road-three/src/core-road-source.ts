import {
  occupiedRoadCellViewsInChunk,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { ChunkCoord } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { mergeRoadCellMeshes } from './road-geometry.js';
import type { RoadMeshData } from './road-mesh-data.js';
import { buildRoadPresentationCellMesh } from './road-presentation-cell.js';
import type { RoadPresentationSource } from './road-chunk-presentation.js';

export function createCoreRoadPresentationSource(config: WorldConfig): RoadPresentationSource {
  return Object.freeze({
    buildChunk(
      roads: RoadSnapshot,
      environment: RoadPlacementEnvironment,
      chunk: ChunkCoord,
    ): RoadMeshData {
      const views = occupiedRoadCellViewsInChunk(roads, chunk, environment, config);
      return mergeRoadCellMeshes(views.map((view) => buildRoadPresentationCellMesh(view, config)));
    },
  });
}
