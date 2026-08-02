import { createEmptyRoadSnapshot, type RoadPlacementEnvironment } from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createRoadStrokeController } from '../src/road-stroke-controller.js';

const environment: RoadPlacementEnvironment = Object.freeze({
  terrainRevision: 1,
  waterSourceTerrainRevision: 1,
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

describe('Road release outside Terrain', () => {
  it('finalizes the latest valid Build plan when release has no Terrain cell', () => {
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'road-build',
      getRoadSnapshot: () => createEmptyRoadSnapshot(WORLD_CONFIG),
      getEnvironment: () => environment,
      onPreview: () => undefined,
    });
    controller.begin(1, { x: 10, z: 10 });
    controller.move(1, { x: 12, z: 10 });
    const plan = controller.end(1, null);
    expect(plan?.valid).toBe(true);
    expect(plan?.requestedCells).toEqual([
      { x: 10, z: 10 },
      { x: 11, z: 10 },
      { x: 12, z: 10 },
    ]);
    expect(controller.getState().strokeActive).toBe(false);
  });

  it('preserves the latest invalid reason when release has no Terrain cell', () => {
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'road-bulldoze',
      getRoadSnapshot: () => createEmptyRoadSnapshot(WORLD_CONFIG),
      getEnvironment: () => environment,
      onPreview: () => undefined,
    });
    controller.begin(1, { x: 10, z: 10 });
    const plan = controller.end(1, null);
    expect(plan?.valid).toBe(false);
    expect(plan?.invalidReason).toBe('road:no-change');
    expect(controller.getState().strokeActive).toBe(false);
  });
});
