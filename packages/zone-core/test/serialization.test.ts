import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  createZoneSnapshot,
  decodeZoneSaveV1,
  encodeZoneSaveV1,
  type ZoneSaveV1,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function sourceSnapshot() {
  const codes = new Uint8Array(CELL_COUNT);
  codes[0] = RESIDENTIAL_ZONE_CODE;
  codes[1] = COMMERCIAL_ZONE_CODE;
  codes[CELL_COUNT - 1] = INDUSTRIAL_ZONE_CODE;
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 17,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('ZoneSaveV1', () => {
  it('preserves the canonical zero-byte ZoneSaveV1 base64 wire representation without DOM codecs', () => {
    const snapshot = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: new Uint8Array(CELL_COUNT),
      },
      WORLD_CONFIG,
    );

    expect(CELL_COUNT % 3).toBe(1);
    expect(encodeZoneSaveV1(snapshot).definitionCodes).toBe(
      'AAAA'.repeat(Math.floor(CELL_COUNT / 3)) + 'AA==',
    );
  });

  it('round-trips Zone bytes and revision exactly', () => {
    const source = sourceSnapshot();
    const encoded = encodeZoneSaveV1(source);
    expect(encoded).toMatchObject({
      schemaVersion: 1,
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 17,
    });
    expect(Object.isFrozen(encoded)).toBe(true);

    const decoded = decodeZoneSaveV1(encoded, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.revision).toBe(source.revision);
    expect(decoded.value.definitionCodes).toEqual(source.definitionCodes);
  });

  it.each([
    ['zone-save:invalid-schema', null],
    ['zone-save:invalid-schema', { schemaVersion: 2 }],
    [
      'zone-save:invalid-dimensions',
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth - 1,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: 'AA==',
      },
    ],
    [
      'zone-save:invalid-metadata',
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: -1,
        definitionCodes: 'AA==',
      },
    ],
    [
      'zone-save:invalid-base64',
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: 'not-base64',
      },
    ],
    [
      'zone-save:invalid-byte-length',
      {
        schemaVersion: 1,
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 0,
        definitionCodes: 'AA==',
      },
    ],
  ] as const)('rejects malformed save with %s', (code, input) => {
    const result = decodeZoneSaveV1(input, WORLD_CONFIG);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code }) });
  });

  it('rejects unknown Zone definition codes', () => {
    const valid = encodeZoneSaveV1(sourceSnapshot());
    const bytes = new Uint8Array(CELL_COUNT);
    bytes[0] = 4;
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const malformed: ZoneSaveV1 = { ...valid, definitionCodes: btoa(binary) };

    expect(decodeZoneSaveV1(malformed, WORLD_CONFIG)).toEqual({
      ok: false,
      error: { code: 'zone-save:invalid-zone' },
    });
  });
});
