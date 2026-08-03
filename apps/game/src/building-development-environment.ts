import type { BuildingDevelopmentEnvironment } from '@web-three-city/building-core';
import { roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import { terrainCellSurfaceProfile, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { triangleIndexFor, type WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  findZoneRoadAccess,
  zoneDefinitionCodeAt,
  zoneDefinitionForCode,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';

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

export function createBuildingDevelopmentEnvironment(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
  config: WorldConfig,
): BuildingDevelopmentEnvironment {
  if (
    terrain.width !== config.mapWidth ||
    terrain.height !== config.mapHeight ||
    roads.width !== config.mapWidth ||
    roads.height !== config.mapHeight ||
    zones.width !== config.mapWidth ||
    zones.height !== config.mapHeight ||
    water.width !== config.mapWidth ||
    water.height !== config.mapHeight
  ) {
    throw new RangeError('building-environment:invalid-dimensions');
  }
  if (water.sourceTerrainRevision !== terrain.revision)
    throw new RangeError('building-environment:incoherent-revision');
  const seaMask = water.seaTriangleMask.slice();
  const environment: BuildingDevelopmentEnvironment = Object.freeze({
    terrainRevision: terrain.revision,
    waterSourceTerrainRevision: water.sourceTerrainRevision,
    roadRevision: roads.revision,
    zoneRevision: zones.revision,
    surfaceAt(cell) {
      if (!validCell(cell, config)) throw new RangeError('building-environment:invalid-cell');
      return terrainCellSurfaceProfile(terrain, cell, config);
    },
    isDry(cell) {
      if (!validCell(cell, config)) return false;
      const first = triangleIndexFor(cell.x, cell.z, 0, config.mapWidth);
      const second = triangleIndexFor(cell.x, cell.z, 1, config.mapWidth);
      return seaMask[first] === 0 && seaMask[second] === 0;
    },
    isRoadOccupied(cell) {
      return validCell(cell, config) && roadOccupiedAt(roads, cell);
    },
    zoneDefinitionIdAt(cell) {
      if (!validCell(cell, config)) return null;
      return zoneDefinitionForCode(zoneDefinitionCodeAt(zones, cell))?.id ?? null;
    },
    roadAccessAt(cell) {
      return findZoneRoadAccess(
        cell,
        {
          surfaceAt: environment.surfaceAt,
          isDry: environment.isDry,
          isRoadOccupied: environment.isRoadOccupied,
          isBlockedByNonZoneOccupancy: () => false,
        },
        config,
      );
    },
  });
  return environment;
}
