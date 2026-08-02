import {
  createEmptyRoadSnapshot,
  planRoadMutation,
  type RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it, vi } from 'vitest';
import { routeRoadPreview } from './game-input.js';

function environment(): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: 3,
    waterSourceTerrainRevision: 3,
    surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
      return Object.freeze({
        cell: Object.freeze({ ...cell }),
        corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
        shape: 'flat',
        minimumLevel: 2,
        maximumLevel: 2,
        slopeAxis: null,
      });
    },
    isDry: () => true,
  });
}

describe('routeRoadPreview', () => {
  it('forwards the captured base snapshot, current plan, and environment unchanged', () => {
    const baseRoads = createEmptyRoadSnapshot(WORLD_CONFIG);
    const world = environment();
    const plan = planRoadMutation(
      baseRoads,
      {
        operation: 'build',
        definitionId: 'basic-road',
        cells: [{ x: 4, z: 4 }],
      },
      world,
      WORLD_CONFIG,
    );
    const roadPreview = {
      clear: vi.fn(),
      show: vi.fn(),
    };

    routeRoadPreview(roadPreview, baseRoads, plan, world);

    expect(roadPreview.show).toHaveBeenCalledOnce();
    expect(roadPreview.show).toHaveBeenCalledWith(baseRoads, plan, world);
    expect(roadPreview.clear).not.toHaveBeenCalled();
  });

  it('clears Preview when the controller clears the captured transaction', () => {
    const roadPreview = {
      clear: vi.fn(),
      show: vi.fn(),
    };

    routeRoadPreview(roadPreview, null, null, null);

    expect(roadPreview.clear).toHaveBeenCalledOnce();
    expect(roadPreview.show).not.toHaveBeenCalled();
  });

  it('clears Preview when any captured transaction component is missing', () => {
    const baseRoads = createEmptyRoadSnapshot(WORLD_CONFIG);
    const world = environment();
    const roadPreview = {
      clear: vi.fn(),
      show: vi.fn(),
    };

    routeRoadPreview(roadPreview, baseRoads, null, world);

    expect(roadPreview.clear).toHaveBeenCalledOnce();
    expect(roadPreview.show).not.toHaveBeenCalled();
  });
});
