import type {
  RoadMutationPlan,
  RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { buildRoadInvalidMarker } from '../src/index.js';

const TEST_CONFIG: WorldConfig = Object.freeze({
  mapWidth: 8,
  mapHeight: 8,
  chunkSize: 4,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 6,
  seaLevel: 1,
  dioramaBaseY: -1,
});

function plan(cells: readonly Readonly<{ x: number; z: number }>[]): RoadMutationPlan {
  return Object.freeze({
    operation: 'build',
    baseRoadRevision: 0,
    baseTerrainRevision: 1,
    baseWaterSourceTerrainRevision: 1,
    requestedCells: Object.freeze(cells.map((cell) => Object.freeze({ ...cell }))),
    addedCells: Object.freeze([]),
    removedCells: Object.freeze([]),
    topologyChangedCells: Object.freeze([]),
    proposedDefinitionCodes: new Uint8Array(TEST_CONFIG.mapWidth * TEST_CONFIG.mapHeight),
    dirtyChunks: Object.freeze([]),
    valid: false,
    invalidReason: 'road:wet-cell',
  });
}

function environment(ramp = false): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: 1,
    waterSourceTerrainRevision: 1,
    surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
      return Object.freeze({
        cell: Object.freeze({ ...cell }),
        corners: ramp
          ? Object.freeze({ nw: 2, ne: 2, sw: 1, se: 1 })
          : Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
        shape: ramp ? 'ramp-north' : 'flat',
        minimumLevel: ramp ? 1 : 2,
        maximumLevel: 2,
        slopeAxis: ramp ? 'north-south' : null,
      });
    },
    isDry: () => true,
  });
}

describe('buildRoadInvalidMarker', () => {
  it('builds two crossed line segments for every requested invalid cell', () => {
    const data = buildRoadInvalidMarker(
      plan([
        { x: 1, z: 1 },
        { x: 2, z: 1 },
      ]),
      environment(),
      TEST_CONFIG,
    );

    expect(data.segmentCount).toBe(4);
    expect(data.positions).toHaveLength(4 * 2 * 3);
    expect([...data.positions].every(Number.isFinite)).toBe(true);
  });

  it('follows the Terrain surface with a fixed offset on a ramp', () => {
    const data = buildRoadInvalidMarker(plan([{ x: 1, z: 1 }]), environment(true), TEST_CONFIG);
    const yValues = [...data.positions].filter((_, index) => index % 3 === 1);

    expect(new Set(yValues.map((value) => value.toFixed(5))).size).toBeGreaterThan(1);
    expect(Math.min(...yValues)).toBeGreaterThan(TEST_CONFIG.heightStep);
  });

  it('returns an empty marker for a valid Road plan', () => {
    const valid = Object.freeze({ ...plan([{ x: 1, z: 1 }]), valid: true, invalidReason: null });
    expect(buildRoadInvalidMarker(valid, environment(), TEST_CONFIG)).toMatchObject({
      segmentCount: 0,
      positions: new Float32Array(),
    });
  });
});
