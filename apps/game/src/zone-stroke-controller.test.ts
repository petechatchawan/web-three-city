import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  RESIDENTIAL_ZONE_CODE,
  createEmptyZoneSnapshot,
  createZoneSnapshot,
  type ZoneMutationPlan,
  type ZonePlacementEnvironment,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import { describe, expect, it, vi } from 'vitest';
import { createZoneStrokeController } from './zone-stroke-controller.js';

function flat(cell: CellCoord): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    corners: Object.freeze({ nw: 1, ne: 1, sw: 1, se: 1 }),
    shape: 'flat',
    minimumLevel: 1,
    maximumLevel: 1,
    slopeAxis: null,
  });
}

function environment(revision = 4): ZonePlacementEnvironment {
  return Object.freeze({
    terrainRevision: revision,
    waterSourceTerrainRevision: revision,
    roadRevision: revision,
    occupancyRevision: revision,
    surfaceAt: flat,
    isDry: () => true,
    isRoadOccupied: () => false,
    isBlockedByNonZoneOccupancy: () => false,
    roadAccessAt(cell: CellCoord) {
      return Object.freeze({
        direction: 'north' as const,
        distance: 1 as const,
        roadCell: Object.freeze({ x: cell.x, z: cell.z - 1 }),
      });
    },
  });
}

function snapshotWithZone(cell: CellCoord): ZoneSnapshot {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = RESIDENTIAL_ZONE_CODE;
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 3,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('ZoneStrokeController', () => {
  it('captures immutable state at pointer-down and maps Residential mode to Paint', () => {
    let zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    let world = environment(4);
    const previews: (ZoneMutationPlan | null)[] = [];
    const controller = createZoneStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'zone-residential',
      getZoneSnapshot: () => zones,
      getEnvironment: () => world,
      onPreview: (_base, plan) => previews.push(plan),
    });

    expect(controller.begin(7, { x: 8, z: 8 })).toBe(true);
    zones = snapshotWithZone({ x: 20, z: 20 });
    world = environment(9);
    const finalPlan = controller.end(7, { x: 8, z: 8 });

    expect(finalPlan).toMatchObject({
      operation: 'paint',
      definitionId: 'residential',
      baseZoneRevision: 0,
      baseTerrainRevision: 4,
      requestedCells: [{ x: 8, z: 8 }],
      changedCells: [{ x: 8, z: 8 }],
      valid: true,
    });
    expect(previews.at(-1)).toBeNull();
  });

  it('shrinks Paint Preview on reverse then branches from retained tail', () => {
    const previews: ZoneMutationPlan[] = [];
    const controller = createZoneStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'zone-commercial',
      getZoneSnapshot: () => createEmptyZoneSnapshot(WORLD_CONFIG),
      getEnvironment: () => environment(),
      onPreview: (_base, plan) => {
        if (plan !== null) previews.push(plan);
      },
    });

    controller.begin(1, { x: 1, z: 1 });
    controller.move(1, { x: 4, z: 1 });
    controller.move(1, { x: 2, z: 1 });
    expect(previews.at(-1)?.requestedCells).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
    ]);
    controller.move(1, { x: 2, z: 3 });
    expect(controller.end(1, { x: 2, z: 3 })?.requestedCells).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 2, z: 2 },
      { x: 2, z: 3 },
    ]);
  });

  it('uses identical reversible semantics for Remove', () => {
    const zones = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 3,
        definitionCodes: (() => {
          const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
          for (let x = 1; x <= 4; x += 1) codes[WORLD_CONFIG.mapWidth + x] = RESIDENTIAL_ZONE_CODE;
          return codes;
        })(),
      },
      WORLD_CONFIG,
    );
    const controller = createZoneStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'zone-remove',
      getZoneSnapshot: () => zones,
      getEnvironment: () => environment(),
      onPreview: () => undefined,
    });

    controller.begin(1, { x: 1, z: 1 });
    controller.move(1, { x: 4, z: 1 });
    controller.move(1, { x: 2, z: 1 });
    expect(controller.end(1, { x: 2, z: 1 })?.changedCells).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
    ]);
  });

  it('rejects a second pointer and clears Preview on cancellation', () => {
    const onPreview = vi.fn();
    const controller = createZoneStrokeController({
      config: WORLD_CONFIG,
      getMode: () => 'zone-industrial',
      getZoneSnapshot: () => createEmptyZoneSnapshot(WORLD_CONFIG),
      getEnvironment: () => environment(),
      onPreview,
    });

    expect(controller.begin(1, { x: 2, z: 2 })).toBe(true);
    expect(controller.begin(2, { x: 3, z: 3 })).toBe(false);
    controller.cancel(2);
    expect(controller.getState().strokeActive).toBe(true);
    controller.cancelAll();
    expect(controller.getState()).toEqual({
      mode: 'zone-industrial',
      strokeActive: false,
      previewValid: null,
      previewCellCount: 0,
    });
    expect(onPreview).toHaveBeenLastCalledWith(null, null, null);
  });
});
