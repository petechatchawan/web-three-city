import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  COMMERCIAL_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  createZoneSnapshot,
} from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { buildZoneOverlayMesh } from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function flatSurface(cell: CellCoord, level = 2): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: cell.x, z: cell.z }),
    corners: Object.freeze({ nw: level, ne: level, sw: level, se: level }),
    shape: 'flat',
    minimumLevel: level,
    maximumLevel: level,
    slopeAxis: null,
  });
}

describe('Zone overlay geometry', () => {
  it('builds centered inset flat quads at authoritative height plus offset', () => {
    const cell = { x: 64, z: 64 };
    const codes = new Uint8Array(CELL_COUNT);
    codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = RESIDENTIAL_ZONE_CODE;
    const zones = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 1,
        definitionCodes: codes,
      },
      WORLD_CONFIG,
    );

    const mesh = buildZoneOverlayMesh(zones, [cell], flatSurface, WORLD_CONFIG);
    expect(mesh.cellCount).toBe(1);
    expect(mesh.positions).toHaveLength(12);
    expect(mesh.indices).toEqual(new Uint32Array([0, 2, 1, 1, 2, 3]));
    expect(mesh.groups).toEqual([{ start: 0, count: 6, materialIndex: 0 }]);
    expect(mesh.bounds).toEqual({
      minX: 0.08,
      maxX: 0.92,
      minY: 1.03,
      maxY: 1.03,
      minZ: 0.08,
      maxZ: 0.92,
    });
  });

  it('creates deterministic material groups for R/C/I cells', () => {
    const cells = [
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 3, z: 1 },
    ];
    const codes = new Uint8Array(CELL_COUNT);
    codes[cells[0]!.z * WORLD_CONFIG.mapWidth + cells[0]!.x] = RESIDENTIAL_ZONE_CODE;
    codes[cells[1]!.z * WORLD_CONFIG.mapWidth + cells[1]!.x] = COMMERCIAL_ZONE_CODE;
    codes[cells[2]!.z * WORLD_CONFIG.mapWidth + cells[2]!.x] = INDUSTRIAL_ZONE_CODE;
    const zones = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 2,
        definitionCodes: codes,
      },
      WORLD_CONFIG,
    );

    const first = buildZoneOverlayMesh(zones, cells, flatSurface, WORLD_CONFIG);
    const second = buildZoneOverlayMesh(zones, cells, flatSurface, WORLD_CONFIG);
    expect(first.positions).toEqual(second.positions);
    expect(first.indices).toEqual(second.indices);
    expect(first.groups).toEqual([
      { start: 0, count: 6, materialIndex: 0 },
      { start: 6, count: 6, materialIndex: 1 },
      { start: 12, count: 6, materialIndex: 2 },
    ]);
  });

  it('rejects non-flat surfaces and skips empty cells', () => {
    const cell = { x: 1, z: 1 };
    const empty = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: new Uint8Array(CELL_COUNT),
      },
      WORLD_CONFIG,
    );
    expect(buildZoneOverlayMesh(empty, [cell], flatSurface, WORLD_CONFIG).cellCount).toBe(0);

    const codes = empty.definitionCodes;
    codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = RESIDENTIAL_ZONE_CODE;
    const zoned = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 1,
        definitionCodes: codes,
      },
      WORLD_CONFIG,
    );
    expect(() =>
      buildZoneOverlayMesh(
        zoned,
        [cell],
        (target) => ({ ...flatSurface(target), shape: 'ramp-north' }),
        WORLD_CONFIG,
      ),
    ).toThrow('zone-geometry:unsupported-surface');
  });
});
