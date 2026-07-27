import { err, ok, WORLD_CONFIG } from '@web-three-city/world-core';
import type { Result } from '@web-three-city/world-core';
import { createTerrainMap } from './terrain-map.js';
import type { TerrainMap } from './terrain-map.js';

export interface TerrainSaveV1 {
  readonly schemaVersion: 1;
  readonly generatorVersion: 'coastal-v1';
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly generationAttempt: number;
  readonly revision: number;
  readonly heightLevels: string;
}

export type TerrainSaveErrorCode =
  | 'terrain-save:invalid-schema'
  | 'terrain-save:invalid-dimensions'
  | 'terrain-save:invalid-metadata'
  | 'terrain-save:invalid-base64'
  | 'terrain-save:invalid-byte-length'
  | 'terrain-save:invalid-terrain';

export interface TerrainSaveError {
  readonly code: TerrainSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
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

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function encodeTerrainSaveV1(map: TerrainMap): TerrainSaveV1 {
  return {
    schemaVersion: 1,
    generatorVersion: 'coastal-v1',
    width: map.width,
    height: map.height,
    seed: map.seed,
    generationAttempt: map.generationAttempt,
    revision: map.revision,
    heightLevels: bytesToBase64(map.heightLevels),
  };
}

export function decodeTerrainSaveV1(input: unknown): Result<TerrainMap, TerrainSaveError> {
  if (!isRecord(input) || input.schemaVersion !== 1 || input.generatorVersion !== 'coastal-v1') {
    return err({ code: 'terrain-save:invalid-schema' });
  }

  if (input.width !== WORLD_CONFIG.mapWidth || input.height !== WORLD_CONFIG.mapHeight) {
    return err({ code: 'terrain-save:invalid-dimensions' });
  }

  if (
    !isInteger(input.seed) ||
    !isInteger(input.generationAttempt) ||
    input.generationAttempt < 0 ||
    !isInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.heightLevels !== 'string'
  ) {
    return err({ code: 'terrain-save:invalid-metadata' });
  }

  const bytes = base64ToBytes(input.heightLevels);
  if (bytes === null) return err({ code: 'terrain-save:invalid-base64' });

  const expectedLength = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);
  if (bytes.length !== expectedLength) {
    return err({
      code: 'terrain-save:invalid-byte-length',
      details: { expected: expectedLength, actual: bytes.length },
    });
  }

  try {
    return ok(
      createTerrainMap({
        config: WORLD_CONFIG,
        heightLevels: bytes,
        seed: input.seed,
        generatorVersion: 'coastal-v1',
        generationAttempt: input.generationAttempt,
        revision: input.revision,
      }),
    );
  } catch {
    return err({ code: 'terrain-save:invalid-terrain' });
  }
}
