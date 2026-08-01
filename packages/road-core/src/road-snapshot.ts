import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  BASIC_ROAD_CODE,
  EMPTY_ROAD_CODE,
  type RoadDefinitionCode,
  type RoadSnapshot,
} from './contracts.js';

const INTERNAL_CODES = new WeakMap<RoadSnapshot, Uint8Array>();

export interface CreateRoadSnapshotInput {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}

function validCell(snapshot: RoadSnapshot, cell: CellCoord): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < snapshot.width &&
    cell.z < snapshot.height
  );
}

function codesFor(snapshot: RoadSnapshot): Uint8Array {
  return INTERNAL_CODES.get(snapshot) ?? snapshot.definitionCodes;
}

export function createRoadSnapshot(
  input: CreateRoadSnapshotInput,
  config: WorldConfig,
): RoadSnapshot {
  if (input.width !== config.mapWidth || input.height !== config.mapHeight) {
    throw new RangeError('road-snapshot:invalid-dimensions');
  }
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new RangeError('road-snapshot:invalid-revision');
  }

  const expectedLength = config.mapWidth * config.mapHeight;
  if (input.definitionCodes.length !== expectedLength) {
    throw new RangeError('road-snapshot:invalid-byte-length');
  }

  const codes = input.definitionCodes.slice();
  for (const code of codes) {
    if (code !== EMPTY_ROAD_CODE && code !== BASIC_ROAD_CODE) {
      throw new RangeError('road-snapshot:unknown-definition-code');
    }
  }

  const snapshot: RoadSnapshot = {
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

export function createEmptyRoadSnapshot(config: WorldConfig): RoadSnapshot {
  return createRoadSnapshot(
    {
      width: config.mapWidth,
      height: config.mapHeight,
      revision: 0,
      definitionCodes: new Uint8Array(config.mapWidth * config.mapHeight),
    },
    config,
  );
}

export function roadDefinitionCodeAt(snapshot: RoadSnapshot, cell: CellCoord): RoadDefinitionCode {
  if (!validCell(snapshot, cell)) {
    throw new RangeError('road-snapshot:invalid-cell');
  }
  return codesFor(snapshot)[cell.z * snapshot.width + cell.x] as RoadDefinitionCode;
}

export function roadOccupiedAt(snapshot: RoadSnapshot, cell: CellCoord): boolean {
  return roadDefinitionCodeAt(snapshot, cell) !== EMPTY_ROAD_CODE;
}

export function occupiedRoadCellCount(snapshot: RoadSnapshot): number {
  let count = 0;
  for (const code of codesFor(snapshot)) {
    if (code !== EMPTY_ROAD_CODE) count += 1;
  }
  return count;
}
