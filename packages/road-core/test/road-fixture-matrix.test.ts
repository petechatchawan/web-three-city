import type { TerrainCellSurfaceProfile, TerrainShape } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  commitRoadMutation,
  createEmptyRoadSnapshot,
  planRoadMutation,
  roadConnectionMaskAt,
  type RoadInvalidReason,
  type RoadPlacementEnvironment,
} from '../src/index.js';

type RoadFixtureDirection = 'north' | 'east' | 'south' | 'west';

interface RoadDeterministicFixtureCase {
  readonly id: string;
  readonly cells: readonly CellCoord[];
  readonly focusCell: CellCoord;
  readonly shapes?: Readonly<Record<string, TerrainShape>>;
  readonly wetCellKeys?: readonly string[];
  readonly expectedValid: boolean;
  readonly expectedInvalidReason: RoadInvalidReason | null;
  readonly expectedConnections?: readonly RoadFixtureDirection[];
  readonly minimumDirtyChunkCount?: number;
}

const CENTER = Object.freeze({ x: 8, z: 8 });
const NORTH = Object.freeze({ x: 8, z: 7 });
const EAST = Object.freeze({ x: 9, z: 8 });
const SOUTH = Object.freeze({ x: 8, z: 9 });
const WEST = Object.freeze({ x: 7, z: 8 });
const NORTH_SOUTH = Object.freeze(['north', 'south'] as const);
const EAST_WEST = Object.freeze(['east', 'west'] as const);

function valid(
  id: string,
  cells: readonly CellCoord[],
  expectedConnections: readonly RoadFixtureDirection[],
  options: Readonly<{
    focusCell?: CellCoord;
    shapes?: Readonly<Record<string, TerrainShape>>;
    minimumDirtyChunkCount?: number;
  }> = {},
): RoadDeterministicFixtureCase {
  return Object.freeze({
    id,
    cells: Object.freeze([...cells]),
    focusCell: options.focusCell ?? CENTER,
    shapes: options.shapes,
    expectedValid: true,
    expectedInvalidReason: null,
    expectedConnections: Object.freeze([...expectedConnections]),
    minimumDirtyChunkCount: options.minimumDirtyChunkCount,
  });
}

function invalid(
  id: string,
  cells: readonly CellCoord[],
  expectedInvalidReason: RoadInvalidReason,
  options: Readonly<{
    shapes?: Readonly<Record<string, TerrainShape>>;
    wetCellKeys?: readonly string[];
  }> = {},
): RoadDeterministicFixtureCase {
  return Object.freeze({
    id,
    cells: Object.freeze([...cells]),
    focusCell: CENTER,
    shapes: options.shapes,
    wetCellKeys: options.wetCellKeys,
    expectedValid: false,
    expectedInvalidReason,
  });
}

const ROAD_DETERMINISTIC_FIXTURE_CASES = Object.freeze([
  valid('road-isolated', [CENTER], []),
  valid('road-end-north', [CENTER, NORTH], ['north']),
  valid('road-end-east', [CENTER, EAST], ['east']),
  valid('road-end-south', [CENTER, SOUTH], ['south']),
  valid('road-end-west', [CENTER, WEST], ['west']),
  valid('road-straight-ns', [NORTH, CENTER, SOUTH], NORTH_SOUTH),
  valid('road-straight-ew', [WEST, CENTER, EAST], EAST_WEST),
  valid('road-corner-ne', [NORTH, CENTER, EAST], ['north', 'east']),
  valid('road-corner-es', [EAST, CENTER, SOUTH], ['east', 'south']),
  valid('road-corner-sw', [SOUTH, CENTER, WEST], ['south', 'west']),
  valid('road-corner-wn', [WEST, CENTER, NORTH], ['west', 'north']),
  valid('road-t-north', [WEST, CENTER, EAST, NORTH], ['west', 'east', 'north']),
  valid('road-t-east', [NORTH, CENTER, SOUTH, EAST], ['north', 'south', 'east']),
  valid('road-t-south', [WEST, CENTER, EAST, SOUTH], ['west', 'east', 'south']),
  valid('road-t-west', [NORTH, CENTER, SOUTH, WEST], ['north', 'south', 'west']),
  valid('road-four-way', [NORTH, EAST, SOUTH, WEST, CENTER], [
    'north',
    'east',
    'south',
    'west',
  ]),
  valid('road-ramp-north-up', [NORTH, CENTER, SOUTH], NORTH_SOUTH, {
    shapes: Object.freeze({ '8:8': 'ramp-north' }),
  }),
  valid('road-ramp-north-down', [NORTH, CENTER, SOUTH], NORTH_SOUTH, {
    shapes: Object.freeze({ '8:8': 'ramp-south' }),
  }),
  valid('road-ramp-east-up', [WEST, CENTER, EAST], EAST_WEST, {
    shapes: Object.freeze({ '8:8': 'ramp-east' }),
  }),
  valid('road-ramp-east-down', [WEST, CENTER, EAST], EAST_WEST, {
    shapes: Object.freeze({ '8:8': 'ramp-west' }),
  }),
  invalid(
    'road-invalid-ramp-perpendicular',
    [WEST, CENTER, EAST],
    'road:invalid-ramp-topology',
    { shapes: Object.freeze({ '8:8': 'ramp-north' }) },
  ),
  invalid(
    'road-invalid-ramp-junction',
    [NORTH, CENTER, SOUTH, EAST],
    'road:invalid-ramp-topology',
    { shapes: Object.freeze({ '8:8': 'ramp-north' }) },
  ),
  invalid('road-invalid-wet', [CENTER], 'road:wet-cell', {
    wetCellKeys: Object.freeze(['8:8']),
  }),
  valid(
    'road-chunk-boundary',
    [
      Object.freeze({ x: 15, z: 8 }),
      Object.freeze({ x: 16, z: 8 }),
      Object.freeze({ x: 17, z: 8 }),
    ],
    EAST_WEST,
    {
      focusCell: Object.freeze({ x: 16, z: 8 }),
      minimumDirtyChunkCount: 2,
    },
  ),
]);

const EXPECTED_BROWSER_FIXTURE_IDS = [
  'road-isolated',
  'road-end-north',
  'road-end-east',
  'road-end-south',
  'road-end-west',
  'road-straight-ns',
  'road-straight-ew',
  'road-corner-ne',
  'road-corner-es',
  'road-corner-sw',
  'road-corner-wn',
  'road-t-north',
  'road-t-east',
  'road-t-south',
  'road-t-west',
  'road-four-way',
  'road-ramp-north-up',
  'road-ramp-north-down',
  'road-ramp-east-up',
  'road-ramp-east-down',
  'road-invalid-ramp-perpendicular',
  'road-invalid-ramp-junction',
  'road-invalid-wet',
  'road-chunk-boundary',
] as const;

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function profile(cell: CellCoord, shape: TerrainShape = 'flat'): TerrainCellSurfaceProfile {
  const rampNorth = shape === 'ramp-north';
  const rampSouth = shape === 'ramp-south';
  const rampEast = shape === 'ramp-east';
  const rampWest = shape === 'ramp-west';
  const corners = Object.freeze({
    nw: rampNorth || rampWest ? 2 : 1,
    ne: rampNorth || rampEast ? 2 : 1,
    sw: rampSouth || rampWest ? 2 : 1,
    se: rampSouth || rampEast ? 2 : 1,
  });
  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    corners,
    shape,
    minimumLevel: 1,
    maximumLevel: shape === 'flat' ? 1 : 2,
    slopeAxis:
      shape === 'ramp-north' || shape === 'ramp-south'
        ? 'north-south'
        : shape === 'ramp-east' || shape === 'ramp-west'
          ? 'east-west'
          : null,
  });
}

function environment(fixture: RoadDeterministicFixtureCase): RoadPlacementEnvironment {
  const shapes = fixture.shapes ?? {};
  const wet = new Set(fixture.wetCellKeys ?? []);
  return Object.freeze({
    terrainRevision: 7,
    waterSourceTerrainRevision: 7,
    surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
      return profile(cell, shapes[key(cell)] ?? 'flat');
    },
    isDry(cell: CellCoord): boolean {
      return !wet.has(key(cell));
    },
  });
}

function maskFor(directions: readonly RoadFixtureDirection[]): number {
  return directions.reduce((mask, direction) => {
    switch (direction) {
      case 'north':
        return mask | ROAD_NORTH;
      case 'east':
        return mask | ROAD_EAST;
      case 'south':
        return mask | ROAD_SOUTH;
      case 'west':
        return mask | ROAD_WEST;
    }
  }, 0);
}

describe('Road deterministic fixture matrix replacement authority', () => {
  it('covers every generated Road browser fixture before Playwright narrowing', () => {
    expect(ROAD_DETERMINISTIC_FIXTURE_CASES.map((fixture) => fixture.id)).toEqual(
      EXPECTED_BROWSER_FIXTURE_IDS,
    );
  });

  for (const fixture of ROAD_DETERMINISTIC_FIXTURE_CASES) {
    it(`${fixture.id} proves deterministic validity, reason, topology, and chunk impact`, () => {
      const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
      const placement = environment(fixture);
      const plan = planRoadMutation(
        roads,
        { operation: 'build', definitionId: 'basic-road', cells: fixture.cells },
        placement,
        WORLD_CONFIG,
      );

      expect(plan.valid).toBe(fixture.expectedValid);
      expect(plan.invalidReason).toBe(fixture.expectedInvalidReason);

      if (!fixture.expectedValid) return;

      const committed = commitRoadMutation(roads, plan, placement, WORLD_CONFIG);
      expect(committed.snapshot.revision).toBe(1);
      expect(plan.addedCells).toHaveLength(fixture.cells.length);
      expect(
        roadConnectionMaskAt(committed.snapshot, fixture.focusCell, placement, WORLD_CONFIG),
      ).toBe(maskFor(fixture.expectedConnections ?? []));

      if (fixture.minimumDirtyChunkCount !== undefined) {
        expect(plan.dirtyChunks.length).toBeGreaterThanOrEqual(fixture.minimumDirtyChunkCount);
      }
    });
  }
});
