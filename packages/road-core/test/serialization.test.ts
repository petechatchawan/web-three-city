import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  BASIC_ROAD_CODE,
  createRoadSnapshot,
  decodeRoadSaveV1,
  encodeRoadSaveV1,
  type RoadSaveV1,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function roadSnapshot() {
  const codes = new Uint8Array(CELL_COUNT);
  codes[3] = BASIC_ROAD_CODE;
  codes[WORLD_CONFIG.mapWidth + 4] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 9,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('RoadSaveV1', () => {
  it('preserves the canonical zero-byte RoadSaveV1 base64 wire representation without DOM codecs', () => {
    const snapshot = createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: new Uint8Array(CELL_COUNT),
      },
      WORLD_CONFIG,
    );

    expect(CELL_COUNT % 3).toBe(1);
    expect(encodeRoadSaveV1(snapshot).definitionCodes).toBe(
      'AAAA'.repeat(Math.floor(CELL_COUNT / 3)) + 'AA==',
    );
  });

  it('round-trips authoritative road bytes without derived topology', () => {
    const original = roadSnapshot();
    const encoded = encodeRoadSaveV1(original);
    const decoded = decodeRoadSaveV1(encoded, WORLD_CONFIG);

    expect(encoded).toEqual({
      schemaVersion: 1,
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 9,
      definitionCodes: encoded.definitionCodes,
    });
    expect('connections' in encoded).toBe(false);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.revision).toBe(original.revision);
    expect(decoded.value.definitionCodes).toEqual(original.definitionCodes);
    expect(encodeRoadSaveV1(decoded.value)).toEqual(encoded);
  });

  it.each([
    [{}, 'road-save:invalid-schema'],
    [{ schemaVersion: 2 }, 'road-save:invalid-schema'],
    [
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth - 1,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: 'AA==',
      },
      'road-save:invalid-dimensions',
    ],
    [
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: -1,
        definitionCodes: 'AA==',
      },
      'road-save:invalid-metadata',
    ],
    [
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: 'not-base64',
      },
      'road-save:invalid-base64',
    ],
  ])('rejects malformed saves with %s', (input, code) => {
    expect(decodeRoadSaveV1(input, WORLD_CONFIG)).toEqual({ ok: false, error: { code } });
  });

  it('rejects wrong byte length and unknown definition codes', () => {
    const shortSave: RoadSaveV1 = {
      schemaVersion: 1,
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
      definitionCodes: btoa(String.fromCharCode(0)),
    };
    expect(decodeRoadSaveV1(shortSave, WORLD_CONFIG)).toMatchObject({
      ok: false,
      error: { code: 'road-save:invalid-byte-length' },
    });

    const unknown = new Uint8Array(CELL_COUNT);
    unknown[0] = 4;
    const unknownSave: RoadSaveV1 = {
      schemaVersion: 1,
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 0,
      definitionCodes: btoa(String.fromCharCode(...unknown)),
    };
    expect(decodeRoadSaveV1(unknownSave, WORLD_CONFIG)).toEqual({
      ok: false,
      error: { code: 'road-save:invalid-road' },
    });
  });
});
