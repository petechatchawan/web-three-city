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
  type RoadPlacementEnvironment,
} from '../src/index.js';
import {
  ROAD_DETERMINISTIC_FIXTURE_CASES,
  type RoadDeterministicFixtureCase,
  type RoadFixtureDirection,
} from './road-fixture-matrix-cases.js';

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
