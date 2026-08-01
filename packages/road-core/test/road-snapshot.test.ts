import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  BASIC_ROAD_CODE,
  BASIC_ROAD_DEFINITION,
  EMPTY_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  occupiedRoadCellCount,
  roadDefinitionCodeAt,
  roadDefinitionForCode,
  roadDefinitionForId,
  roadOccupiedAt,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

describe('road snapshot', () => {
  it('exposes one frozen basic road definition with deterministic lookup', () => {
    expect(Object.isFrozen(BASIC_ROAD_DEFINITION)).toBe(true);
    expect(BASIC_ROAD_DEFINITION).toMatchObject({
      id: 'basic-road',
      code: BASIC_ROAD_CODE,
    });
    expect(roadDefinitionForCode(EMPTY_ROAD_CODE)).toBeNull();
    expect(roadDefinitionForCode(BASIC_ROAD_CODE)).toBe(BASIC_ROAD_DEFINITION);
    expect(roadDefinitionForId('basic-road')).toBe(BASIC_ROAD_DEFINITION);
    expect(() => roadDefinitionForId('unknown-road' as never)).toThrow(
      'road-definition:unknown-id',
    );
  });

  it('creates an empty immutable road map', () => {
    const snapshot = createEmptyRoadSnapshot(WORLD_CONFIG);

    expect(snapshot).toMatchObject({
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
    });
    expect(snapshot.definitionCodes).toHaveLength(CELL_COUNT);
    expect(occupiedRoadCellCount(snapshot)).toBe(0);
    expect(roadOccupiedAt(snapshot, { x: 0, z: 0 })).toBe(false);
    expect(roadDefinitionCodeAt(snapshot, { x: 0, z: 0 })).toBe(EMPTY_ROAD_CODE);
  });

  it('defensively copies source and exposed definition buffers', () => {
    const source = new Uint8Array(CELL_COUNT);
    source[5] = BASIC_ROAD_CODE;
    const snapshot = createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 3,
        definitionCodes: source,
      },
      WORLD_CONFIG,
    );

    source[5] = EMPTY_ROAD_CODE;
    expect(roadDefinitionCodeAt(snapshot, { x: 5, z: 0 })).toBe(BASIC_ROAD_CODE);

    const exposed = snapshot.definitionCodes;
    exposed[5] = EMPTY_ROAD_CODE;
    expect(roadDefinitionCodeAt(snapshot, { x: 5, z: 0 })).toBe(BASIC_ROAD_CODE);
    expect(roadOccupiedAt(snapshot, { x: 5, z: 0 })).toBe(true);
    expect(occupiedRoadCellCount(snapshot)).toBe(1);
  });

  it('rejects malformed dimensions, revisions, buffers, and definition codes', () => {
    const valid = new Uint8Array(CELL_COUNT);

    expect(() =>
      createRoadSnapshot(
        {
          width: WORLD_CONFIG.mapWidth - 1,
          height: WORLD_CONFIG.mapHeight,
          revision: 0,
          definitionCodes: valid,
        },
        WORLD_CONFIG,
      ),
    ).toThrow('road-snapshot:invalid-dimensions');
    expect(() =>
      createRoadSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: -1,
          definitionCodes: valid,
        },
        WORLD_CONFIG,
      ),
    ).toThrow('road-snapshot:invalid-revision');
    expect(() =>
      createRoadSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: 0,
          definitionCodes: new Uint8Array(CELL_COUNT - 1),
        },
        WORLD_CONFIG,
      ),
    ).toThrow('road-snapshot:invalid-byte-length');

    const unknown = valid.slice();
    unknown[0] = 2;
    expect(() =>
      createRoadSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: 0,
          definitionCodes: unknown,
        },
        WORLD_CONFIG,
      ),
    ).toThrow('road-snapshot:unknown-definition-code');
  });

  it.each([
    { x: -1, z: 0 },
    { x: 0, z: -1 },
    { x: WORLD_CONFIG.mapWidth, z: 0 },
    { x: 0, z: WORLD_CONFIG.mapHeight },
    { x: 0.5, z: 0 },
  ])('rejects invalid road cell coordinates %o', (cell) => {
    const snapshot = createEmptyRoadSnapshot(WORLD_CONFIG);

    expect(() => roadDefinitionCodeAt(snapshot, cell)).toThrow('road-snapshot:invalid-cell');
  });
});
