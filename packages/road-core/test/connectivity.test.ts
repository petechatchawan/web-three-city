import type { TerrainCellSurfaceProfile, TerrainShape } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  BASIC_ROAD_CODE,
  BASIC_ROAD_DEFINITION,
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  RoadContractError,
  createRoadSnapshot,
  occupiedRoadCellViewsInChunk,
  roadCellViewAt,
  roadConnectionMaskAt,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

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

function environment(
  shapes: Readonly<Record<string, TerrainShape>> = {},
  dry = true,
): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: 7,
    waterSourceTerrainRevision: 7,
    surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
      return profile(cell, shapes[key(cell)] ?? 'flat');
    },
    isDry(): boolean {
      return dry;
    },
  });
}

function roads(cells: readonly CellCoord[], revision = 2): RoadSnapshot {
  const codes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('road connectivity', () => {
  it('derives deterministic isolated, end, straight, corner, T, and four-way masks', () => {
    const center = { x: 8, z: 8 };
    const flat = environment();

    expect(roadConnectionMaskAt(roads([center]), center, flat, WORLD_CONFIG)).toBe(0);
    expect(roadConnectionMaskAt(roads([center, { x: 8, z: 7 }]), center, flat, WORLD_CONFIG)).toBe(
      ROAD_NORTH,
    );
    expect(
      roadConnectionMaskAt(
        roads([center, { x: 8, z: 7 }, { x: 8, z: 9 }]),
        center,
        flat,
        WORLD_CONFIG,
      ),
    ).toBe(ROAD_NORTH | ROAD_SOUTH);
    expect(
      roadConnectionMaskAt(
        roads([center, { x: 8, z: 7 }, { x: 9, z: 8 }]),
        center,
        flat,
        WORLD_CONFIG,
      ),
    ).toBe(ROAD_NORTH | ROAD_EAST);
    expect(
      roadConnectionMaskAt(
        roads([center, { x: 8, z: 7 }, { x: 9, z: 8 }, { x: 8, z: 9 }]),
        center,
        flat,
        WORLD_CONFIG,
      ),
    ).toBe(ROAD_NORTH | ROAD_EAST | ROAD_SOUTH);
    expect(
      roadConnectionMaskAt(
        roads([center, { x: 8, z: 7 }, { x: 9, z: 8 }, { x: 8, z: 9 }, { x: 7, z: 8 }]),
        center,
        flat,
        WORLD_CONFIG,
      ),
    ).toBe(ROAD_NORTH | ROAD_EAST | ROAD_SOUTH | ROAD_WEST);
  });

  it('derives frozen cell views and deterministic chunk ordering', () => {
    const snapshot = roads([
      { x: 3, z: 2 },
      { x: 1, z: 1 },
      { x: 2, z: 1 },
    ]);
    const flat = environment();
    const cell = roadCellViewAt(snapshot, { x: 1, z: 1 }, flat, WORLD_CONFIG);

    expect(cell).not.toBeNull();
    expect(cell).toMatchObject({
      definition: BASIC_ROAD_DEFINITION,
      connections: ROAD_EAST,
    });
    expect(Object.isFrozen(cell)).toBe(true);
    expect(Object.isFrozen(cell?.cell)).toBe(true);
    expect(Object.isFrozen(cell?.surface)).toBe(true);
    expect(roadCellViewAt(snapshot, { x: 0, z: 0 }, flat, WORLD_CONFIG)).toBeNull();

    const views = occupiedRoadCellViewsInChunk(snapshot, { x: 0, z: 0 }, flat, WORLD_CONFIG);
    expect(views.map((view) => view.cell)).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 3, z: 2 },
    ]);
    expect(Object.isFrozen(views)).toBe(true);
  });

  it('rejects incoherent placement revisions for derived queries', () => {
    const incoherent: RoadPlacementEnvironment = {
      ...environment(),
      waterSourceTerrainRevision: 6,
    };

    expect(() =>
      roadCellViewAt(roads([{ x: 1, z: 1 }]), { x: 1, z: 1 }, incoherent, WORLD_CONFIG),
    ).toThrow(RoadContractError);
  });
});
