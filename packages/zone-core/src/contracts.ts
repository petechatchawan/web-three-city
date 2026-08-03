import type { ChunkCoord, TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';

export const EMPTY_ZONE_CODE = 0 as const;
export const RESIDENTIAL_ZONE_CODE = 1 as const;
export const COMMERCIAL_ZONE_CODE = 2 as const;
export const INDUSTRIAL_ZONE_CODE = 3 as const;

export type ZoneDefinitionId = 'residential' | 'commercial' | 'industrial';
export type ZoneDefinitionCode =
  | typeof EMPTY_ZONE_CODE
  | typeof RESIDENTIAL_ZONE_CODE
  | typeof COMMERCIAL_ZONE_CODE
  | typeof INDUSTRIAL_ZONE_CODE;
export type ZoneOperation = 'paint' | 'remove';
export type ZoneRoadDirection = 'north' | 'east' | 'south' | 'west';

export interface ZoneDefinition {
  readonly id: ZoneDefinitionId;
  readonly code: Exclude<ZoneDefinitionCode, typeof EMPTY_ZONE_CODE>;
  readonly label: 'Residential' | 'Commercial' | 'Industrial';
}

export interface ZoneSnapshot {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}

export interface ZoneCounts {
  readonly residential: number;
  readonly commercial: number;
  readonly industrial: number;
  readonly total: number;
}

export interface ZoneRoadAccess {
  readonly direction: ZoneRoadDirection;
  readonly distance: 1 | 2 | 3;
  readonly roadCell: CellCoord;
}

export interface ZoneRoadAccessEnvironment {
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile;
  isDry(cell: CellCoord): boolean;
  isRoadOccupied(cell: CellCoord): boolean;
  isBlockedByNonZoneOccupancy(cell: CellCoord): boolean;
}

export interface ZonePlacementEnvironment extends ZoneRoadAccessEnvironment {
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly roadRevision: number;
  readonly occupancyRevision: number;
  roadAccessAt(cell: CellCoord): ZoneRoadAccess | null;
}

export type ZoneInvalidReason =
  | 'zone:invalid-state'
  | 'zone:invalid-environment'
  | 'zone:invalid-cell'
  | 'zone:unknown-definition'
  | 'zone:no-change'
  | 'zone:unsupported-terrain'
  | 'zone:wet-cell'
  | 'zone:road-occupied'
  | 'zone:occupied'
  | 'zone:zone-conflict'
  | 'zone:road-access-required';

export interface ZoneInvalidCell {
  readonly cell: CellCoord;
  readonly reason: ZoneInvalidReason;
}

export interface ZoneStrokeInput {
  readonly operation: ZoneOperation;
  readonly definitionId: ZoneDefinitionId | null;
  readonly cells: readonly CellCoord[];
}

export interface ZoneMutationPlan {
  readonly operation: ZoneOperation;
  readonly definitionId: ZoneDefinitionId | null;
  readonly baseZoneRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly baseRoadRevision: number;
  readonly baseOccupancyRevision: number;
  readonly requestedCells: readonly CellCoord[];
  readonly changedCells: readonly CellCoord[];
  readonly unchangedCells: readonly CellCoord[];
  readonly invalidCells: readonly ZoneInvalidCell[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: ZoneInvalidReason | null;
}

export interface ZoneMutationReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly operation: ZoneOperation;
  readonly definitionId: ZoneDefinitionId | null;
  readonly changedCellCount: number;
  readonly unchangedCellCount: number;
  readonly dirtyChunks: readonly ChunkCoord[];
}

export type ZoneContractErrorCode =
  | 'zone:invalid-plan'
  | 'zone:stale-zone-plan'
  | 'zone:stale-terrain-plan'
  | 'zone:stale-water-plan'
  | 'zone:stale-road-plan'
  | 'zone:stale-occupancy-plan'
  | 'zone:invalid-proposed-state'
  | 'zone:incoherent-world-revision';

export class ZoneContractError extends Error {
  readonly code: ZoneContractErrorCode;

  constructor(code: ZoneContractErrorCode) {
    super(code);
    this.name = 'ZoneContractError';
    this.code = code;
  }
}
