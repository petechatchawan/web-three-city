import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import type { ZoneSnapshot } from './contracts.js';
import { createZoneSnapshot } from './zone-snapshot.js';

export interface ZoneSaveV1 {
  readonly schemaVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: string;
}

export type ZoneSaveErrorCode =
  | 'zone-save:invalid-schema'
  | 'zone-save:invalid-dimensions'
  | 'zone-save:invalid-metadata'
  | 'zone-save:invalid-base64'
  | 'zone-save:invalid-byte-length'
  | 'zone-save:invalid-zone';

export interface ZoneSaveError {
  readonly code: ZoneSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    encoded += BASE64_ALPHABET[(value >>> 18) & 63];
    encoded += BASE64_ALPHABET[(value >>> 12) & 63];
    encoded += hasSecond ? BASE64_ALPHABET[(value >>> 6) & 63] : '=';
    encoded += hasThird ? BASE64_ALPHABET[value & 63] : '=';
  }
  return encoded;
}

function base64ToBytes(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return null;
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let output = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(value[index]!);
    const second = BASE64_ALPHABET.indexOf(value[index + 1]!);
    const third = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2]!);
    const fourth = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3]!);
    const decoded = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (output < bytes.length) bytes[output++] = (decoded >>> 16) & 255;
    if (output < bytes.length) bytes[output++] = (decoded >>> 8) & 255;
    if (output < bytes.length) bytes[output++] = decoded & 255;
  }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeZoneSaveV1(zones: ZoneSnapshot): ZoneSaveV1 {
  return Object.freeze({
    schemaVersion: 1 as const,
    width: zones.width,
    height: zones.height,
    revision: zones.revision,
    definitionCodes: bytesToBase64(zones.definitionCodes),
  });
}

export function decodeZoneSaveV1(
  input: unknown,
  config: WorldConfig,
): Result<ZoneSnapshot, ZoneSaveError> {
  if (!isRecord(input) || input.schemaVersion !== 1) {
    return err({ code: 'zone-save:invalid-schema' });
  }
  if (input.width !== config.mapWidth || input.height !== config.mapHeight) {
    return err({ code: 'zone-save:invalid-dimensions' });
  }
  if (
    typeof input.revision !== 'number' ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.definitionCodes !== 'string'
  ) {
    return err({ code: 'zone-save:invalid-metadata' });
  }

  const bytes = base64ToBytes(input.definitionCodes);
  if (bytes === null) return err({ code: 'zone-save:invalid-base64' });
  const expectedLength = config.mapWidth * config.mapHeight;
  if (bytes.length !== expectedLength) {
    return err({
      code: 'zone-save:invalid-byte-length',
      details: Object.freeze({ expected: expectedLength, actual: bytes.length }),
    });
  }

  try {
    return ok(
      createZoneSnapshot(
        {
          width: config.mapWidth,
          height: config.mapHeight,
          revision: input.revision,
          definitionCodes: bytes,
        },
        config,
      ),
    );
  } catch {
    return err({ code: 'zone-save:invalid-zone' });
  }
}
