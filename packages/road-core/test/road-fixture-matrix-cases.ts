import type { TerrainShape } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { RoadInvalidReason } from '../src/index.js';

export type RoadFixtureDirection = 'north' | 'east' | 'south' | 'west';

export interface RoadDeterministicFixtureCase {
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

const NORTH_SOUTH = Object.freeze(['north', 'south'] as const);
const EAST_WEST = Object.freeze(['east', 'west'] as const);

export const ROAD_DETERMINISTIC_FIXTURE_CASES: readonly RoadDeterministicFixtureCase[] =
  Object.freeze([
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
    valid(
      'road-t-north',
      [WEST, CENTER, EAST, NORTH],
      ['west', 'east', 'north'],
    ),
    valid(
      'road-t-east',
      [NORTH, CENTER, SOUTH, EAST],
      ['north', 'south', 'east'],
    ),
    valid(
      'road-t-south',
      [WEST, CENTER, EAST, SOUTH],
      ['west', 'east', 'south'],
    ),
    valid(
      'road-t-west',
      [NORTH, CENTER, SOUTH, WEST],
      ['north', 'south', 'west'],
    ),
    valid(
      'road-four-way',
      [NORTH, EAST, SOUTH, WEST, CENTER],
      ['north', 'east', 'south', 'west'],
    ),
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
