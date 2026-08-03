import {
  createEmptyZoneSnapshot,
  planZoneMutation,
  type ZonePlacementEnvironment,
} from '@web-three-city/zone-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it, vi } from 'vitest';
import { routeZonePreview } from './game-input.js';

function environment(): ZonePlacementEnvironment {
  return Object.freeze({
    terrainRevision: 3,
    waterSourceTerrainRevision: 3,
    roadRevision: 2,
    occupancyRevision: 0,
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

describe('routeZonePreview', () => {
  it('forwards the captured Zone snapshot and plan unchanged', () => {
    const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    const plan = planZoneMutation(
      zones,
      {
        operation: 'paint',
        definitionId: 'residential',
        cells: [{ x: 4, z: 4 }],
      },
      environment(),
      WORLD_CONFIG,
    );
    const preview = { clear: vi.fn(), show: vi.fn() };

    routeZonePreview(preview, zones, plan);

    expect(preview.show).toHaveBeenCalledWith(zones, plan);
    expect(preview.clear).not.toHaveBeenCalled();
  });

  it('clears the isolated Zone Preview when the transaction ends', () => {
    const preview = { clear: vi.fn(), show: vi.fn() };

    routeZonePreview(preview, null, null);

    expect(preview.clear).toHaveBeenCalledOnce();
    expect(preview.show).not.toHaveBeenCalled();
  });
});
