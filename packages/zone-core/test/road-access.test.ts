import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { findZoneRoadAccess, type ZoneRoadAccessEnvironment } from '../src/index.js';

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function flat(level = 1): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: 0, z: 0 }),
    corners: Object.freeze({ nw: level, ne: level, sw: level, se: level }),
    shape: 'flat',
    minimumLevel: level,
    maximumLevel: level,
    slopeAxis: null,
  });
}

function rampNorth(): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: 0, z: 0 }),
    corners: Object.freeze({ nw: 2, ne: 2, sw: 1, se: 1 }),
    shape: 'ramp-north',
    minimumLevel: 1,
    maximumLevel: 2,
    slopeAxis: 'north-south',
  });
}

function environment(input: {
  readonly roads: readonly CellCoord[];
  readonly blocked?: readonly CellCoord[];
  readonly wet?: readonly CellCoord[];
  readonly surfaces?: Readonly<Record<string, TerrainCellSurfaceProfile>>;
}): ZoneRoadAccessEnvironment {
  const roads = new Set(input.roads.map(key));
  const blocked = new Set((input.blocked ?? []).map(key));
  const wet = new Set((input.wet ?? []).map(key));
  return Object.freeze({
    surfaceAt(cell: CellCoord) {
      return input.surfaces?.[key(cell)] ?? flat();
    },
    isDry(cell: CellCoord) {
      return !wet.has(key(cell));
    },
    isRoadOccupied(cell: CellCoord) {
      return roads.has(key(cell));
    },
    isBlockedByNonZoneOccupancy(cell: CellCoord) {
      return blocked.has(key(cell));
    },
  });
}

describe('Zone Road access', () => {
  it.each([1, 2, 3])('accepts committed Road at cardinal depth %s', (distance) => {
    const candidate = { x: 8, z: 8 };
    const road = { x: 8, z: 8 - distance };
    expect(findZoneRoadAccess(candidate, environment({ roads: [road] }), WORLD_CONFIG)).toEqual({
      direction: 'north',
      distance,
      roadCell: road,
    });
  });

  it('rejects Road beyond depth three', () => {
    expect(
      findZoneRoadAccess(
        { x: 8, z: 8 },
        environment({ roads: [{ x: 8, z: 4 }] }),
        WORLD_CONFIG,
      ),
    ).toBeNull();
  });

  it('chooses shortest distance then North East South West', () => {
    const candidate = { x: 8, z: 8 };
    expect(
      findZoneRoadAccess(
        candidate,
        environment({
          roads: [
            { x: 8, z: 6 },
            { x: 9, z: 8 },
            { x: 8, z: 9 },
          ],
        }),
        WORLD_CONFIG,
      ),
    ).toEqual({ direction: 'east', distance: 1, roadCell: { x: 9, z: 8 } });

    expect(
      findZoneRoadAccess(
        candidate,
        environment({
          roads: [
            { x: 8, z: 7 },
            { x: 9, z: 8 },
          ],
        }),
        WORLD_CONFIG,
      ),
    ).toEqual({ direction: 'north', distance: 1, roadCell: { x: 8, z: 7 } });
  });

  it('rejects blocked, wet, non-flat, and grade-discontinuous intermediate cells', () => {
    const candidate = { x: 8, z: 8 };
    const road = { x: 8, z: 5 };
    const middle = { x: 8, z: 7 };

    expect(
      findZoneRoadAccess(candidate, environment({ roads: [road], blocked: [middle] }), WORLD_CONFIG),
    ).toBeNull();
    expect(
      findZoneRoadAccess(candidate, environment({ roads: [road], wet: [middle] }), WORLD_CONFIG),
    ).toBeNull();
    expect(
      findZoneRoadAccess(
        candidate,
        environment({ roads: [road], surfaces: { [key(middle)]: rampNorth() } }),
        WORLD_CONFIG,
      ),
    ).toBeNull();
    expect(
      findZoneRoadAccess(
        candidate,
        environment({ roads: [road], surfaces: { [key(middle)]: flat(2) } }),
        WORLD_CONFIG,
      ),
    ).toBeNull();
  });

  it('accepts a compatible Ramp endpoint and rejects a Ramp side edge', () => {
    const candidate = { x: 8, z: 8 };
    const northRoad = { x: 8, z: 7 };
    const eastRoad = { x: 9, z: 8 };

    expect(
      findZoneRoadAccess(
        candidate,
        environment({ roads: [northRoad], surfaces: { [key(northRoad)]: rampNorth() } }),
        WORLD_CONFIG,
      ),
    ).toEqual({ direction: 'north', distance: 1, roadCell: northRoad });

    expect(
      findZoneRoadAccess(
        candidate,
        environment({ roads: [eastRoad], surfaces: { [key(eastRoad)]: rampNorth() } }),
        WORLD_CONFIG,
      ),
    ).toBeNull();
  });
});
