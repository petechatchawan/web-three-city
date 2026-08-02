import { createRoadSnapshot, roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import {
  createTerrainMap,
  terrainCellSurfaceProfile,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { triangleIndexFor, type WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { findZoneRoadAccess, type ZonePlacementEnvironment } from '@web-three-city/zone-core';

export interface ZoneWorldOccupancy {
  readonly revision: number;
  isBlocked(cell: CellCoord): boolean;
}

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

export function createZonePlacementEnvironment(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  roads: RoadSnapshot,
  occupancy: ZoneWorldOccupancy,
  config: WorldConfig,
): ZonePlacementEnvironment {
  if (terrain.width !== config.mapWidth || terrain.height !== config.mapHeight) {
    throw new RangeError('zone-environment:invalid-terrain-dimensions');
  }
  if (water.width !== config.mapWidth || water.height !== config.mapHeight) {
    throw new RangeError('zone-environment:invalid-water-dimensions');
  }
  if (roads.width !== config.mapWidth || roads.height !== config.mapHeight) {
    throw new RangeError('zone-environment:invalid-road-dimensions');
  }
  if (water.sourceTerrainRevision !== terrain.revision) {
    throw new RangeError('zone-environment:incoherent-revision');
  }
  if (
    !Number.isSafeInteger(occupancy.revision) ||
    occupancy.revision < 0 ||
    typeof occupancy.isBlocked !== 'function'
  ) {
    throw new RangeError('zone-environment:invalid-occupancy');
  }
  if (water.seaTriangleMask.length !== config.mapWidth * config.mapHeight * 2) {
    throw new RangeError('zone-environment:invalid-water-mask');
  }

  const terrainSnapshot = createTerrainMap({
    config,
    heightLevels: terrain.heightLevels,
    seed: terrain.seed,
    generatorVersion: terrain.generatorVersion,
    generationAttempt: terrain.generationAttempt,
    revision: terrain.revision,
  });
  const roadSnapshot = createRoadSnapshot(
    {
      width: roads.width,
      height: roads.height,
      revision: roads.revision,
      definitionCodes: roads.definitionCodes,
    },
    config,
  );
  const seaTriangleMask = water.seaTriangleMask.slice();
  const occupancyMask = new Uint8Array(config.mapWidth * config.mapHeight);
  for (let z = 0; z < config.mapHeight; z += 1) {
    for (let x = 0; x < config.mapWidth; x += 1) {
      occupancyMask[z * config.mapWidth + x] = occupancy.isBlocked({ x, z }) ? 1 : 0;
    }
  }

  let environment!: ZonePlacementEnvironment;
  environment = Object.freeze({
    terrainRevision: terrainSnapshot.revision,
    waterSourceTerrainRevision: water.sourceTerrainRevision,
    roadRevision: roadSnapshot.revision,
    occupancyRevision: occupancy.revision,
    surfaceAt(cell: CellCoord) {
      if (!validCell(cell, config)) throw new RangeError('zone-environment:invalid-cell');
      return terrainCellSurfaceProfile(terrainSnapshot, cell, config);
    },
    isDry(cell: CellCoord) {
      if (!validCell(cell, config)) return false;
      const first = triangleIndexFor(cell.x, cell.z, 0, config.mapWidth);
      const second = triangleIndexFor(cell.x, cell.z, 1, config.mapWidth);
      return seaTriangleMask[first] === 0 && seaTriangleMask[second] === 0;
    },
    isRoadOccupied(cell: CellCoord) {
      return validCell(cell, config) && roadOccupiedAt(roadSnapshot, cell);
    },
    isBlockedByNonZoneOccupancy(cell: CellCoord) {
      return validCell(cell, config) && occupancyMask[cell.z * config.mapWidth + cell.x] === 1;
    },
    roadAccessAt(cell: CellCoord) {
      return findZoneRoadAccess(cell, environment, config);
    },
  });

  return environment;
}
