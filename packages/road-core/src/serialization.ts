import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import { createRoadSnapshot } from './road-snapshot.js';
import type { RoadSnapshot } from './contracts.js';

export interface RoadSaveV1 {
  readonly schemaVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: string;
}

export type RoadSaveErrorCode =
  | 'road-save:invalid-schema'
  | 'road-save:invalid-dimensions'
  | 'road-save:invalid-metadata'
  | 'road-save:invalid-base64'
  | 'road-save:invalid-byte-length'
  | 'road-save:invalid-road';

export interface RoadSaveError {
  readonly code: RoadSaveErrorCode;
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

export function encodeRoadSaveV1(roads: RoadSnapshot): RoadSaveV1 {
  return Object.freeze({
    schemaVersion: 1 as const,
    width: roads.width,
    height: roads.height,
    revision: roads.revision,
    definitionCodes: bytesToBase64(roads.definitionCodes),
  });
}

export function decodeRoadSaveV1(
  input: unknown,
  config: WorldConfig,
): Result<RoadSnapshot, RoadSaveError> {
  if (!isRecord(input) || input.schemaVersion !== 1) {
    return err({ code: 'road-save:invalid-schema' });
  }
  if (input.width !== config.mapWidth || input.height !== config.mapHeight) {
    return err({ code: 'road-save:invalid-dimensions' });
  }
  if (
    typeof input.revision !== 'number' ||
    !Number.isInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.definitionCodes !== 'string'
  ) {
    return err({ code: 'road-save:invalid-metadata' });
  }

  const bytes = base64ToBytes(input.definitionCodes);
  if (bytes === null) return err({ code: 'road-save:invalid-base64' });
  const expectedLength = config.mapWidth * config.mapHeight;
  if (bytes.length !== expectedLength) {
    return err({
      code: 'road-save:invalid-byte-length',
      details: Object.freeze({ expected: expectedLength, actual: bytes.length }),
    });
  }

  try {
    return ok(
      createRoadSnapshot(
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
    return err({ code: 'road-save:invalid-road' });
  }
}
