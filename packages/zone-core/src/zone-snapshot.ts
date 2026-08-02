import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  COMMERCIAL_ZONE_CODE,
  EMPTY_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  type ZoneCounts,
  type ZoneDefinitionCode,
  type ZoneSnapshot,
} from './contracts.js';

const INTERNAL_CODES = new WeakMap<ZoneSnapshot, Uint8Array>();

export interface CreateZoneSnapshotInput {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}

function validCell(snapshot: ZoneSnapshot, cell: CellCoord): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < snapshot.width &&
    cell.z < snapshot.height
  );
}

function codesFor(snapshot: ZoneSnapshot): Uint8Array {
  return INTERNAL_CODES.get(snapshot) ?? snapshot.definitionCodes;
}

function validCode(code: number): code is ZoneDefinitionCode {
  return (
    code === EMPTY_ZONE_CODE ||
    code === RESIDENTIAL_ZONE_CODE ||
    code === COMMERCIAL_ZONE_CODE ||
    code === INDUSTRIAL_ZONE_CODE
  );
}

export function createZoneSnapshot(
  input: CreateZoneSnapshotInput,
  config: WorldConfig,
): ZoneSnapshot {
  if (input.width !== config.mapWidth || input.height !== config.mapHeight) {
    throw new RangeError('zone-snapshot:invalid-dimensions');
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new RangeError('zone-snapshot:invalid-revision');
  }

  const expectedLength = config.mapWidth * config.mapHeight;
  if (input.definitionCodes.length !== expectedLength) {
    throw new RangeError('zone-snapshot:invalid-byte-length');
  }

  const codes = input.definitionCodes.slice();
  for (const code of codes) {
    if (!validCode(code)) {
      throw new RangeError('zone-snapshot:unknown-definition-code');
    }
  }

  const snapshot: ZoneSnapshot = {
    width: input.width,
    height: input.height,
    revision: input.revision,
    get definitionCodes(): Uint8Array {
      return codes.slice();
    },
  };
  INTERNAL_CODES.set(snapshot, codes);
  return Object.freeze(snapshot);
}

export function createEmptyZoneSnapshot(config: WorldConfig): ZoneSnapshot {
  return createZoneSnapshot(
    {
      width: config.mapWidth,
      height: config.mapHeight,
      revision: 0,
      definitionCodes: new Uint8Array(config.mapWidth * config.mapHeight),
    },
    config,
  );
}

export function zoneDefinitionCodeAt(
  snapshot: ZoneSnapshot,
  cell: CellCoord,
): ZoneDefinitionCode {
  if (!validCell(snapshot, cell)) {
    throw new RangeError('zone-snapshot:invalid-cell');
  }
  return codesFor(snapshot)[cell.z * snapshot.width + cell.x] as ZoneDefinitionCode;
}

export function zoneOccupiedAt(snapshot: ZoneSnapshot, cell: CellCoord): boolean {
  return zoneDefinitionCodeAt(snapshot, cell) !== EMPTY_ZONE_CODE;
}

export function zoneCounts(snapshot: ZoneSnapshot): ZoneCounts {
  let residential = 0;
  let commercial = 0;
  let industrial = 0;

  for (const code of codesFor(snapshot)) {
    switch (code) {
      case RESIDENTIAL_ZONE_CODE:
        residential += 1;
        break;
      case COMMERCIAL_ZONE_CODE:
        commercial += 1;
        break;
      case INDUSTRIAL_ZONE_CODE:
        industrial += 1;
        break;
      default:
        break;
    }
  }

  return Object.freeze({
    residential,
    commercial,
    industrial,
    total: residential + commercial + industrial,
  });
}
