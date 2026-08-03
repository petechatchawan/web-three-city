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
