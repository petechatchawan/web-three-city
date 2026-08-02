import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ZONE_CODE,
  EMPTY_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  createEmptyZoneSnapshot,
  createZoneSnapshot,
  zoneCounts,
  zoneDefinitionCodeAt,
  zoneOccupiedAt,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function snapshotWithCodes(entries: readonly [number, number][]) {
  const codes = new Uint8Array(CELL_COUNT);
  for (const [index, code] of entries) codes[index] = code;
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 7,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('Zone snapshot', () => {
  it('creates an empty immutable Zone map', () => {
    const snapshot = createEmptyZoneSnapshot(WORLD_CONFIG);
    expect(snapshot).toMatchObject({
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
    });
    expect(snapshot.definitionCodes).toHaveLength(CELL_COUNT);
    expect(zoneDefinitionCodeAt(snapshot, { x: 0, z: 0 })).toBe(EMPTY_ZONE_CODE);
    expect(zoneOccupiedAt(snapshot, { x: 0, z: 0 })).toBe(false);
    expect(zoneCounts(snapshot)).toEqual({
      residential: 0,
      commercial: 0,
      industrial: 0,
      total: 0,
    });
  });

  it('defensively copies source and exposed definition buffers', () => {
    const source = new Uint8Array(CELL_COUNT);
    source[5] = RESIDENTIAL_ZONE_CODE;
    const snapshot = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 3,
        definitionCodes: source,
      },
      WORLD_CONFIG,
    );

    source[5] = EMPTY_ZONE_CODE;
    expect(zoneDefinitionCodeAt(snapshot, { x: 5, z: 0 })).toBe(RESIDENTIAL_ZONE_CODE);

    const exposed = snapshot.definitionCodes;
    exposed[5] = EMPTY_ZONE_CODE;
    expect(zoneDefinitionCodeAt(snapshot, { x: 5, z: 0 })).toBe(RESIDENTIAL_ZONE_CODE);
    expect(zoneOccupiedAt(snapshot, { x: 5, z: 0 })).toBe(true);
  });

  it('derives exact R/C/I counts', () => {
    const snapshot = snapshotWithCodes([
      [0, RESIDENTIAL_ZONE_CODE],
      [1, RESIDENTIAL_ZONE_CODE],
      [2, COMMERCIAL_ZONE_CODE],
      [3, INDUSTRIAL_ZONE_CODE],
      [4, INDUSTRIAL_ZONE_CODE],
      [5, INDUSTRIAL_ZONE_CODE],
    ]);
    expect(zoneCounts(snapshot)).toEqual({
      residential: 2,
      commercial: 1,
      industrial: 3,
      total: 6,
    });
  });

  it('rejects malformed dimensions, revisions, buffers, and definition codes', () => {
    const valid = new Uint8Array(CELL_COUNT);
    expect(() =>
      createZoneSnapshot(
        {
          width: WORLD_CONFIG.mapWidth - 1,
          height: WORLD_CONFIG.mapHeight,
          revision: 0,
          definitionCodes: valid,
        },
        WORLD_CONFIG,
      ),
    ).toThrow('zone-snapshot:invalid-dimensions');
    expect(() =>
      createZoneSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: -1,
          definitionCodes: valid,
        },
        WORLD_CONFIG,
      ),
    ).toThrow('zone-snapshot:invalid-revision');
    expect(() =>
      createZoneSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: 0,
          definitionCodes: new Uint8Array(CELL_COUNT - 1),
        },
        WORLD_CONFIG,
      ),
    ).toThrow('zone-snapshot:invalid-byte-length');
    const unknown = valid.slice();
    unknown[0] = 4;
    expect(() =>
      createZoneSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: 0,
          definitionCodes: unknown,
        },
        WORLD_CONFIG,
      ),
    ).toThrow('zone-snapshot:unknown-definition-code');
  });

  it.each([
    { x: -1, z: 0 },
    { x: 0, z: -1 },
    { x: WORLD_CONFIG.mapWidth, z: 0 },
    { x: 0, z: WORLD_CONFIG.mapHeight },
    { x: 0.5, z: 0 },
  ])('rejects invalid Zone cell coordinates %o', (cell) => {
    const snapshot = createEmptyZoneSnapshot(WORLD_CONFIG);
    expect(() => zoneDefinitionCodeAt(snapshot, cell)).toThrow('zone-snapshot:invalid-cell');
  });
});
