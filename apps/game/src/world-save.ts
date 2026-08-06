import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  decodeRciSaveV1,
  encodeRciSaveV1,
  type RciSaveV1,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import * as legacy from './world-save-legacy.js';

export {
  encodeWorldSaveV1,
  encodeWorldSaveV2,
  encodeWorldSaveV3,
  encodeWorldSaveV4,
} from './world-save-legacy.js';
export type { WorldSaveV1, WorldSaveV2, WorldSaveV3, WorldSaveV4 } from './world-save-legacy.js';

export interface WorldSaveV5 {
  readonly kind: 'world-save';
  readonly schemaVersion: 5;
  readonly terrain: legacy.WorldSaveV4['terrain'];
  readonly roads: legacy.WorldSaveV4['roads'];
  readonly zones: legacy.WorldSaveV4['zones'];
  readonly buildings: legacy.WorldSaveV4['buildings'];
  readonly simulation: legacy.WorldSaveV4['simulation'];
  readonly rci: RciSaveV1;
}

export interface DecodedWorldState extends legacy.DecodedWorldState {
  readonly rci: RciSnapshot;
}

export type WorldSaveErrorCode = legacy.WorldSaveErrorCode | 'world-save:invalid-rci';

export interface WorldSaveError {
  readonly code: WorldSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeWorldSaveV5(
  terrain: Parameters<typeof legacy.encodeWorldSaveV4>[0],
  roads: Parameters<typeof legacy.encodeWorldSaveV4>[1],
  zones: Parameters<typeof legacy.encodeWorldSaveV4>[2],
  buildings: Parameters<typeof legacy.encodeWorldSaveV4>[3],
  simulation: Parameters<typeof legacy.encodeWorldSaveV4>[4],
  rci: RciSnapshot,
): WorldSaveV5 {
  const base = legacy.encodeWorldSaveV4(terrain, roads, zones, buildings, simulation);
  return Object.freeze({
    ...base,
    schemaVersion: 5,
    rci: encodeRciSaveV1(rci),
  });
}

export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError> {
  const isV5 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 5;
  const legacyInput = isV5 ? Object.freeze({ ...input, schemaVersion: 4 }) : input;
  const base = legacy.decodeWorldSave(legacyInput, config);
  if (!base.ok) return base;

  if (!isV5) {
    return ok(
      Object.freeze({
        ...base.value,
        rci: createInitialRciSnapshot({ absoluteTick: base.value.simulation.absoluteTick }),
      }),
    );
  }

  if (!('rci' in input)) return err({ code: 'world-save:invalid-schema' });
  const decodedRci = decodeRciSaveV1(input.rci, {
    buildings: base.value.buildings,
    simulation: base.value.simulation,
    registries: createFoundationRciRegistries(),
  });
  if (!decodedRci.ok) {
    return err({
      code: 'world-save:invalid-rci',
      details: Object.freeze({ rciCode: decodedRci.error.code }),
    });
  }

  return ok(Object.freeze({ ...base.value, rci: decodedRci.value }));
}
