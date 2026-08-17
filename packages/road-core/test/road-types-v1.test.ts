import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  ARTERIAL_ROAD_CODE,
  BASIC_ROAD_CODE,
  COLLECTOR_ROAD_CODE,
  commitRoadMutation,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  decodeRoadSaveV1,
  encodeRoadSaveV1,
  planRoadMutation,
  roadDefinitionCodeAt,
  roadDefinitionForCode,
  roadDefinitionForId,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function surface(cell: CellCoord): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    corners: Object.freeze({ nw: 1, ne: 1, sw: 1, se: 1 }),
    shape: 'flat',
    minimumLevel: 1,
    maximumLevel: 1,
    slopeAxis: null,
  });
}

function environment(): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: 7,
    waterSourceTerrainRevision: 7,
    surfaceAt: surface,
    isDry: () => true,
  });
}

function snapshotWith(code: number, cell: CellCoord = { x: 4, z: 4 }): RoadSnapshot {
  const codes = new Uint8Array(CELL_COUNT);
  codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = code;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 3,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('Road Definition Catalog v1', () => {
  it('resolves stable Local, Collector, and Arterial definitions', () => {
    expect(BASIC_ROAD_CODE).toBe(1);
    expect(COLLECTOR_ROAD_CODE).toBe(2);
    expect(ARTERIAL_ROAD_CODE).toBe(3);

    expect(roadDefinitionForCode(BASIC_ROAD_CODE)).toMatchObject({
      id: 'basic-road',
      code: 1,
      width: 0.72,
    });
    expect(roadDefinitionForCode(COLLECTOR_ROAD_CODE)).toMatchObject({
      id: 'collector-road',
      code: 2,
      width: 0.82,
    });
    expect(roadDefinitionForCode(ARTERIAL_ROAD_CODE)).toMatchObject({
      id: 'arterial-road',
      code: 3,
      width: 0.92,
    });

    expect(roadDefinitionForId('basic-road').code).toBe(BASIC_ROAD_CODE);
    expect(roadDefinitionForId('collector-road').code).toBe(COLLECTOR_ROAD_CODE);
    expect(roadDefinitionForId('arterial-road').code).toBe(ARTERIAL_ROAD_CODE);
    expect(() => roadDefinitionForId('unknown-road' as never)).toThrow('road-definition:unknown-id');
  });

  it('keeps RoadSaveV1 byte-compatible while accepting codes 0 through 3', () => {
    const codes = new Uint8Array(CELL_COUNT);
    codes[0] = 0;
    codes[1] = BASIC_ROAD_CODE;
    codes[2] = COLLECTOR_ROAD_CODE;
    codes[3] = ARTERIAL_ROAD_CODE;
    const snapshot = createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 11,
        definitionCodes: codes,
      },
      WORLD_CONFIG,
    );

    const encoded = encodeRoadSaveV1(snapshot);
    expect(encoded.schemaVersion).toBe(1);
    const decoded = decodeRoadSaveV1(encoded, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.definitionCodes.slice(0, 4)).toEqual(new Uint8Array([0, 1, 2, 3]));
    expect(encodeRoadSaveV1(decoded.value)).toEqual(encoded);
  });
});

describe('Road type replacement semantics', () => {
  it('replaces an occupied Local cell with Collector without changing occupancy', () => {
    const cell = { x: 4, z: 4 };
    const original = snapshotWith(BASIC_ROAD_CODE, cell);
    const plan = planRoadMutation(
      original,
      { operation: 'build', definitionId: 'collector-road', cells: [cell] },
      environment(),
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.invalidReason).toBeNull();
    expect(plan.addedCells).toEqual([]);
    expect(plan.removedCells).toEqual([]);
    expect(plan.topologyChangedCells).toEqual([cell]);
    expect(plan.proposedDefinitionCodes[cell.z * WORLD_CONFIG.mapWidth + cell.x]).toBe(
      COLLECTOR_ROAD_CODE,
    );

    const committed = commitRoadMutation(original, plan, environment(), WORLD_CONFIG);
    expect(roadDefinitionCodeAt(committed.snapshot, cell)).toBe(COLLECTOR_ROAD_CODE);
    expect(committed.snapshot.revision).toBe(4);
    expect(committed.receipt).toMatchObject({
      addedCellCount: 0,
      removedCellCount: 0,
      topologyChangedCellCount: 1,
    });
  });

  it('supports deterministic Collector→Arterial→Local replacement and rejects same-type build', () => {
    const cell = { x: 7, z: 8 };
    const env = environment();
    const collector = snapshotWith(COLLECTOR_ROAD_CODE, cell);

    const arterialPlan = planRoadMutation(
      collector,
      { operation: 'build', definitionId: 'arterial-road', cells: [cell] },
      env,
      WORLD_CONFIG,
    );
    expect(arterialPlan.valid).toBe(true);
    const arterial = commitRoadMutation(collector, arterialPlan, env, WORLD_CONFIG).snapshot;
    expect(roadDefinitionCodeAt(arterial, cell)).toBe(ARTERIAL_ROAD_CODE);

    const localPlan = planRoadMutation(
      arterial,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      env,
      WORLD_CONFIG,
    );
    expect(localPlan.valid).toBe(true);
    const local = commitRoadMutation(arterial, localPlan, env, WORLD_CONFIG).snapshot;
    expect(roadDefinitionCodeAt(local, cell)).toBe(BASIC_ROAD_CODE);

    expect(
      planRoadMutation(
        local,
        { operation: 'build', definitionId: 'basic-road', cells: [cell] },
        env,
        WORLD_CONFIG,
      ),
    ).toMatchObject({ valid: false, invalidReason: 'road:no-change' });
  });
});
