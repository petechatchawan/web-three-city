import {
  BASIC_ROAD_DEFINITION,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';

const MARKER_INSET_RATIO = 0.16;
const MARKER_OFFSET = BASIC_ROAD_DEFINITION.surfaceOffset + 0.04;

export interface RoadInvalidMarkerData {
  readonly positions: Float32Array;
  readonly segmentCount: number;
}

function levelAt(
  surface: TerrainCellSurfaceProfile,
  u: number,
  v: number,
): number {
  const { nw, ne, sw, se } = surface.corners;
  return nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v;
}

function positionAt(
  cell: CellCoord,
  surface: TerrainCellSurfaceProfile,
  u: number,
  v: number,
  config: WorldConfig,
): readonly [number, number, number] {
  return Object.freeze([
    (cell.x + u) * config.cellSize,
    levelAt(surface, u, v) * config.heightStep + MARKER_OFFSET,
    (cell.z + v) * config.cellSize,
  ]);
}

export function buildRoadInvalidMarker(
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadInvalidMarkerData {
  if (plan.valid || plan.requestedCells.length === 0) {
    return Object.freeze({ positions: new Float32Array(), segmentCount: 0 });
  }

  const positions: number[] = [];
  const minimum = MARKER_INSET_RATIO;
  const maximum = 1 - MARKER_INSET_RATIO;
  for (const cell of plan.requestedCells) {
    const surface = environment.surfaceAt(cell);
    positions.push(
      ...positionAt(cell, surface, minimum, minimum, config),
      ...positionAt(cell, surface, maximum, maximum, config),
      ...positionAt(cell, surface, maximum, minimum, config),
      ...positionAt(cell, surface, minimum, maximum, config),
    );
  }

  if (!positions.every(Number.isFinite)) {
    throw new RangeError('road-invalid-marker:non-finite-geometry');
  }
  return Object.freeze({
    positions: new Float32Array(positions),
    segmentCount: plan.requestedCells.length * 2,
  });
}
