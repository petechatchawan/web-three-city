import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { ZoneRoadAccess, ZoneRoadAccessEnvironment, ZoneRoadDirection } from './contracts.js';

interface DirectionStep {
  readonly direction: ZoneRoadDirection;
  readonly dx: number;
  readonly dz: number;
}

const DIRECTIONS: readonly DirectionStep[] = Object.freeze([
  Object.freeze({ direction: 'north' as const, dx: 0, dz: -1 }),
  Object.freeze({ direction: 'east' as const, dx: 1, dz: 0 }),
  Object.freeze({ direction: 'south' as const, dx: 0, dz: 1 }),
  Object.freeze({ direction: 'west' as const, dx: -1, dz: 0 }),
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

function steppedCell(origin: CellCoord, step: DirectionStep, distance: number): CellCoord {
  return { x: origin.x + step.dx * distance, z: origin.z + step.dz * distance };
}

function flatLevel(surface: TerrainCellSurfaceProfile): number | null {
  return surface.shape === 'flat' && surface.minimumLevel === surface.maximumLevel
    ? surface.minimumLevel
    : null;
}

function roadEdgeMatches(
  surface: TerrainCellSurfaceProfile,
  direction: ZoneRoadDirection,
  level: number,
): boolean {
  switch (direction) {
    case 'north':
      return surface.corners.sw === level && surface.corners.se === level;
    case 'east':
      return surface.corners.nw === level && surface.corners.sw === level;
    case 'south':
      return surface.corners.nw === level && surface.corners.ne === level;
    case 'west':
      return surface.corners.ne === level && surface.corners.se === level;
  }
}

function intermediateCellIsEligible(
  cell: CellCoord,
  level: number,
  environment: ZoneRoadAccessEnvironment,
): boolean {
  if (!environment.isDry(cell) || environment.isBlockedByNonZoneOccupancy(cell)) return false;
  return flatLevel(environment.surfaceAt(cell)) === level;
}

export function findZoneRoadAccess(
  candidate: CellCoord,
  environment: ZoneRoadAccessEnvironment,
  config: WorldConfig,
): ZoneRoadAccess | null {
  if (!validCell(candidate, config)) return null;
  const candidateLevel = flatLevel(environment.surfaceAt(candidate));
  if (candidateLevel === null) return null;

  for (const distance of [1, 2, 3] as const) {
    for (const step of DIRECTIONS) {
      const roadCell = steppedCell(candidate, step, distance);
      if (!validCell(roadCell, config) || !environment.isRoadOccupied(roadCell)) continue;

      let pathValid = true;
      for (let offset = 1; offset < distance; offset += 1) {
        const intermediate = steppedCell(candidate, step, offset);
        if (
          !validCell(intermediate, config) ||
          !intermediateCellIsEligible(intermediate, candidateLevel, environment)
        ) {
          pathValid = false;
          break;
        }
      }
      if (!pathValid) continue;

      const roadSurface = environment.surfaceAt(roadCell);
      if (!roadEdgeMatches(roadSurface, step.direction, candidateLevel)) continue;

      return Object.freeze({
        direction: step.direction,
        distance,
        roadCell: Object.freeze({ x: roadCell.x, z: roadCell.z }),
      });
    }
  }

  return null;
}
