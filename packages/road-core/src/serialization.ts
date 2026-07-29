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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return null;
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
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
