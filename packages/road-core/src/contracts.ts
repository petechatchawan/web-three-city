import type { ChunkCoord, TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';

export const EMPTY_ROAD_CODE = 0 as const;
export const BASIC_ROAD_CODE = 1 as const;

export const ROAD_NORTH = 1 << 0;
export const ROAD_EAST = 1 << 1;
export const ROAD_SOUTH = 1 << 2;
export const ROAD_WEST = 1 << 3;

export type RoadDefinitionId = 'basic-road';
export type RoadDefinitionCode = typeof EMPTY_ROAD_CODE | typeof BASIC_ROAD_CODE;
export type RoadOperation = 'build' | 'bulldoze';
export type RoadConnectionMask = number;

export interface RoadDefinition {
  readonly id: 'basic-road';
  readonly code: typeof BASIC_ROAD_CODE;
  readonly width: number;
  readonly surfaceOffset: number;
}

export const BASIC_ROAD_DEFINITION: RoadDefinition = Object.freeze({
  id: 'basic-road',
  code: BASIC_ROAD_CODE,
  width: 0.72,
  surfaceOffset: 0.02,
});

export function roadDefinitionForCode(code: RoadDefinitionCode): RoadDefinition | null {
  return code === EMPTY_ROAD_CODE ? null : BASIC_ROAD_DEFINITION;
}

export function roadDefinitionForId(id: RoadDefinitionId): RoadDefinition {
  if (id !== 'basic-road') {
    throw new RangeError('road-definition:unknown-id');
  }
  return BASIC_ROAD_DEFINITION;
}

export interface RoadSnapshot {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}

export interface RoadPlacementEnvironment {
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile;
  isDry(cell: CellCoord): boolean;
}

export type RoadInvalidReason =
  | 'road:invalid-state'
  | 'road:invalid-cell'
  | 'road:incoherent-world-revision'
  | 'road:no-change'
  | 'road:unsupported-terrain'
  | 'road:wet-cell'
  | 'road:invalid-ramp-topology';

export interface RoadStrokeInput {
  readonly operation: RoadOperation;
  readonly definitionId: 'basic-road';
  readonly cells: readonly CellCoord[];
}

export interface RoadMutationPlan {
  readonly operation: RoadOperation;
  readonly baseRoadRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly requestedCells: readonly CellCoord[];
  readonly addedCells: readonly CellCoord[];
  readonly removedCells: readonly CellCoord[];
  readonly topologyChangedCells: readonly CellCoord[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: RoadInvalidReason | null;
}

export interface RoadMutationReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly addedCellCount: number;
  readonly removedCellCount: number;
  readonly topologyChangedCellCount: number;
  readonly dirtyChunks: readonly ChunkCoord[];
}

export interface RoadCellView {
  readonly cell: CellCoord;
  readonly definition: RoadDefinition;
  readonly connections: RoadConnectionMask;
  readonly surface: TerrainCellSurfaceProfile;
}

export type RoadContractErrorCode =
  | 'road:invalid-plan'
  | 'road:stale-road-plan'
  | 'road:stale-terrain-plan'
  | 'road:stale-water-plan'
  | 'road:invalid-proposed-state'
  | 'road:incoherent-world-revision';

export class RoadContractError extends Error {
  readonly code: RoadContractErrorCode;

  constructor(code: RoadContractErrorCode) {
    super(code);
    this.name = 'RoadContractError';
    this.code = code;
  }
}
