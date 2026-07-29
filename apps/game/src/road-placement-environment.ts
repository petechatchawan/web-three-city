import type { RoadPlacementEnvironment } from '@web-three-city/road-core';
import {
  createTerrainMap,
  terrainCellSurfaceProfile,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { triangleIndexFor, type WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';

export function createRoadPlacementEnvironment(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  config: WorldConfig,
): RoadPlacementEnvironment {
  if (terrain.width !== config.mapWidth || terrain.height !== config.mapHeight) {
    throw new RangeError('road-environment:invalid-terrain-dimensions');
  }
  if (water.width !== config.mapWidth || water.height !== config.mapHeight) {
    throw new RangeError('road-environment:invalid-water-dimensions');
  }
  if (water.sourceTerrainRevision !== terrain.revision) {
    throw new RangeError('road-environment:incoherent-revision');
  }
  if (water.seaTriangleMask.length !== config.mapWidth * config.mapHeight * 2) {
    throw new RangeError('road-environment:invalid-water-mask');
  }

  const terrainSnapshot = createTerrainMap({
    config,
    heightLevels: terrain.heightLevels,
    seed: terrain.seed,
    generatorVersion: terrain.generatorVersion,
    generationAttempt: terrain.generationAttempt,
    revision: terrain.revision,
  });
  const seaTriangleMask = water.seaTriangleMask.slice();
  const terrainRevision = terrainSnapshot.revision;
  const waterSourceTerrainRevision = water.sourceTerrainRevision;

  return Object.freeze({
    terrainRevision,
    waterSourceTerrainRevision,
    surfaceAt(cell: CellCoord) {
      return terrainCellSurfaceProfile(terrainSnapshot, cell, config);
    },
    isDry(cell: CellCoord) {
      const first = triangleIndexFor(cell.x, cell.z, 0, config.mapWidth);
      const second = triangleIndexFor(cell.x, cell.z, 1, config.mapWidth);
      return seaTriangleMask[first] === 0 && seaTriangleMask[second] === 0;
    },
  });
}
