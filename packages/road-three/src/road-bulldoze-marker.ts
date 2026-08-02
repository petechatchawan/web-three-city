import {
  BASIC_ROAD_DEFINITION,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';

const INSET = 0.14;
const OFFSET = BASIC_ROAD_DEFINITION.surfaceOffset + 0.075;

export interface RoadBulldozeMarkerData {
  readonly positions: Float32Array;
  readonly segmentCount: number;
}

function levelAt(surface: TerrainCellSurfaceProfile, u: number, v: number): number {
  const { nw, ne, sw, se } = surface.corners;
  return nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v;
}

function point(
  cell: CellCoord,
  surface: TerrainCellSurfaceProfile,
  u: number,
  v: number,
  config: WorldConfig,
): readonly [number, number, number] {
  return [
    (cell.x + u - config.mapWidth / 2) * config.cellSize,
    levelAt(surface, u, v) * config.heightStep + OFFSET,
    (cell.z + v - config.mapHeight / 2) * config.cellSize,
  ];
}

export function buildRoadBulldozeMarker(
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadBulldozeMarkerData {
  if (!plan.valid || plan.operation !== 'bulldoze' || plan.removedCells.length === 0) {
    return Object.freeze({ positions: new Float32Array(), segmentCount: 0 });
  }
  const positions: number[] = [];
  const minimum = INSET;
  const maximum = 1 - INSET;
  for (const cell of plan.removedCells) {
    const surface = environment.surfaceAt(cell);
    const nw = point(cell, surface, minimum, minimum, config);
    const ne = point(cell, surface, maximum, minimum, config);
    const se = point(cell, surface, maximum, maximum, config);
    const sw = point(cell, surface, minimum, maximum, config);
    positions.push(
      ...nw,
      ...ne,
      ...ne,
      ...se,
      ...se,
      ...sw,
      ...sw,
      ...nw,
      ...nw,
      ...se,
      ...ne,
      ...sw,
    );
  }
  if (!positions.every(Number.isFinite)) {
    throw new RangeError('road-bulldoze-marker:non-finite-geometry');
  }
  return Object.freeze({
    positions: new Float32Array(positions),
    segmentCount: plan.removedCells.length * 6,
  });
}
