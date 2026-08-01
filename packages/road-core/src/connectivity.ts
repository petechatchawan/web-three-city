import {
  chunkCellBounds,
  type ChunkCoord,
  type TerrainCellSurfaceProfile,
} from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  RoadContractError,
  roadDefinitionForCode,
  type RoadCellView,
  type RoadConnectionMask,
  type RoadInvalidReason,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from './contracts.js';
import { roadDefinitionCodeAt, roadOccupiedAt } from './road-snapshot.js';

const CARDINAL_NEIGHBORS = Object.freeze([
  Object.freeze({ dx: 0, dz: -1, mask: ROAD_NORTH }),
  Object.freeze({ dx: 1, dz: 0, mask: ROAD_EAST }),
  Object.freeze({ dx: 0, dz: 1, mask: ROAD_SOUTH }),
  Object.freeze({ dx: -1, dz: 0, mask: ROAD_WEST }),
]);

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < config.mapWidth &&
    cell.z < config.mapHeight
  );
}

export function assertCoherentRoadEnvironment(environment: RoadPlacementEnvironment): void {
  if (
    !Number.isInteger(environment.terrainRevision) ||
    environment.terrainRevision < 0 ||
    !Number.isInteger(environment.waterSourceTerrainRevision) ||
    environment.waterSourceTerrainRevision < 0 ||
    environment.terrainRevision !== environment.waterSourceTerrainRevision
  ) {
    throw new RoadContractError('road:incoherent-world-revision');
  }
}

function copiedSurface(surface: TerrainCellSurfaceProfile): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: surface.cell.x, z: surface.cell.z }),
    corners: Object.freeze({ ...surface.corners }),
    shape: surface.shape,
    minimumLevel: surface.minimumLevel,
    maximumLevel: surface.maximumLevel,
    slopeAxis: surface.slopeAxis,
  });
}

export function roadConnectionMaskAt(
  snapshot: RoadSnapshot,
  cell: CellCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadConnectionMask {
  assertCoherentRoadEnvironment(environment);
  if (!validCell(cell, config)) {
    throw new RangeError('road-snapshot:invalid-cell');
  }
  if (!roadOccupiedAt(snapshot, cell)) return 0;

  let mask = 0;
  for (const neighbor of CARDINAL_NEIGHBORS) {
    const adjacent = { x: cell.x + neighbor.dx, z: cell.z + neighbor.dz };
    if (validCell(adjacent, config) && roadOccupiedAt(snapshot, adjacent)) {
      mask |= neighbor.mask;
    }
  }
  return mask;
}

export function roadCellPolicyInvalidReason(
  snapshot: RoadSnapshot,
  cell: CellCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadInvalidReason | null {
  assertCoherentRoadEnvironment(environment);
  if (!validCell(cell, config)) return 'road:invalid-cell';
  if (!roadOccupiedAt(snapshot, cell)) return null;
  if (!environment.isDry(cell)) return 'road:wet-cell';

  const surface = environment.surfaceAt(cell);
  const mask = roadConnectionMaskAt(snapshot, cell, environment, config);
  switch (surface.shape) {
    case 'flat':
      return null;
    case 'ramp-north':
    case 'ramp-south':
      return mask === (ROAD_NORTH | ROAD_SOUTH) ? null : 'road:invalid-ramp-topology';
    case 'ramp-east':
    case 'ramp-west':
      return mask === (ROAD_EAST | ROAD_WEST) ? null : 'road:invalid-ramp-topology';
    default:
      return 'road:unsupported-terrain';
  }
}

export function roadCellViewAt(
  snapshot: RoadSnapshot,
  cell: CellCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadCellView | null {
  assertCoherentRoadEnvironment(environment);
  const code = roadDefinitionCodeAt(snapshot, cell);
  const definition = roadDefinitionForCode(code);
  if (definition === null) return null;

  const invalidReason = roadCellPolicyInvalidReason(snapshot, cell, environment, config);
  if (invalidReason !== null) {
    throw new RoadContractError('road:invalid-proposed-state');
  }

  return Object.freeze({
    cell: Object.freeze({ x: cell.x, z: cell.z }),
    definition,
    connections: roadConnectionMaskAt(snapshot, cell, environment, config),
    surface: copiedSurface(environment.surfaceAt(cell)),
  });
}

export function occupiedRoadCellViewsInChunk(
  snapshot: RoadSnapshot,
  chunk: ChunkCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): readonly RoadCellView[] {
  assertCoherentRoadEnvironment(environment);
  const bounds = chunkCellBounds(chunk, config);
  const views: RoadCellView[] = [];
  for (let z = bounds.minCellZ; z <= bounds.maxCellZ; z += 1) {
    for (let x = bounds.minCellX; x <= bounds.maxCellX; x += 1) {
      const view = roadCellViewAt(snapshot, { x, z }, environment, config);
      if (view !== null) views.push(view);
    }
  }
  return Object.freeze(views);
}
