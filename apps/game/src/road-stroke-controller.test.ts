import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it, vi } from 'vitest';
import { createRoadStrokeController } from './road-stroke-controller.js';

const FLAT_SURFACE = Object.freeze({
  cell: Object.freeze({ x: 0, z: 0 }),
  corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
  shape: 'flat' as const,
  minimumLevel: 2,
  maximumLevel: 2,
  slopeAxis: null,
});

function environment(revision = 3): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: revision,
    waterSourceTerrainRevision: revision,
    surfaceAt(cell): TerrainCellSurfaceProfile {
      return Object.freeze({ ...FLAT_SURFACE, cell: Object.freeze({ ...cell }) });
    },
    isDry: () => true,
  });
}

function snapshotWithRoad(cell: Readonly<{ x: number; z: number }>): RoadSnapshot {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 5,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('RoadStrokeController', () => {
  it('captures Road and environment state at pointer-down and returns one final tap plan', () => {
    let roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    let world = environment(3);
    const previews: (RoadMutationPlan | null)[] = [];
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'road-build',
      getRoadSnapshot: () => roads,
      getEnvironment: () => world,
      onPreview: (plan) => previews.push(plan),
    });

    expect(controller.begin(11, { x: 4, z: 7 })).toBe(true);
    roads = snapshotWithRoad({ x: 10, z: 10 });
    world = environment(9);
    const finalPlan = controller.end(11, { x: 4, z: 7 });

    expect(finalPlan).not.toBeNull();
    expect(finalPlan).toMatchObject({
      operation: 'build',
      baseRoadRevision: 0,
      baseTerrainRevision: 3,
      baseWaterSourceTerrainRevision: 3,
      valid: true,
      requestedCells: [{ x: 4, z: 7 }],
      addedCells: [{ x: 4, z: 7 }],
    });
    expect(previews.at(-1)).toBeNull();
    expect(controller.getState()).toEqual({
      mode: 'road-build',
      strokeActive: false,
      previewValid: null,
      previewCellCount: 0,
    });
  });

  it('uses deterministic supercover drag cells, deduplicates them, and replans the final state', () => {
    const previews: RoadMutationPlan[] = [];
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'road-build',
      getRoadSnapshot: () => createEmptyRoadSnapshot(WORLD_CONFIG),
      getEnvironment: () => environment(),
      onPreview: (plan) => {
        if (plan !== null) previews.push(plan);
      },
    });

    controller.begin(1, { x: 1, z: 1 });
    controller.move(1, { x: 4, z: 1 });
    controller.move(1, { x: 2, z: 1 });
    const finalPlan = controller.end(1, { x: 4, z: 1 });

    expect(finalPlan?.requestedCells).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 3, z: 1 },
      { x: 4, z: 1 },
    ]);
    expect(finalPlan?.addedCells).toHaveLength(4);
    expect(previews.length).toBeGreaterThanOrEqual(2);
    expect(previews.at(-1)?.requestedCells).toEqual(finalPlan?.requestedCells);
  });

  it('returns an invalid no-op plan without mutating the captured snapshot', () => {
    const base = snapshotWithRoad({ x: 3, z: 3 });
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'road-build',
      getRoadSnapshot: () => base,
      getEnvironment: () => environment(),
      onPreview: () => undefined,
    });

    controller.begin(1, { x: 3, z: 3 });
    const finalPlan = controller.end(1, { x: 3, z: 3 });

    expect(finalPlan).toMatchObject({ valid: false, invalidReason: 'road:no-change' });
    expect(base.definitionCodes[3 * WORLD_CONFIG.mapWidth + 3]).toBe(BASIC_ROAD_CODE);
  });

  it('cancels only the active pointer and cancelAll clears Preview for second-touch takeover', () => {
    const onPreview = vi.fn<(plan: RoadMutationPlan | null) => void>();
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'road-bulldoze',
      getRoadSnapshot: () => snapshotWithRoad({ x: 8, z: 8 }),
      getEnvironment: () => environment(),
      onPreview,
    });

    expect(controller.begin(1, { x: 8, z: 8 })).toBe(true);
    controller.cancel(2);
    expect(controller.getState().strokeActive).toBe(true);

    controller.cancelAll();
    expect(controller.getState()).toEqual({
      mode: 'road-bulldoze',
      strokeActive: false,
      previewValid: null,
      previewCellCount: 0,
    });
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(controller.end(1, { x: 8, z: 8 })).toBeNull();
  });

  it('refuses to begin outside Road modes or while another Road pointer owns the stroke', () => {
    let mode: 'road-build' | null = null;
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => mode,
      getRoadSnapshot: () => createEmptyRoadSnapshot(WORLD_CONFIG),
      getEnvironment: () => environment(),
      onPreview: () => undefined,
    });

    expect(controller.begin(1, { x: 1, z: 1 })).toBe(false);
    mode = 'road-build';
    expect(controller.begin(1, { x: 1, z: 1 })).toBe(true);
    expect(controller.begin(2, { x: 2, z: 2 })).toBe(false);
  });
});
