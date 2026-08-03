import type { ChunkCoord, TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { ZoneDefinitionId, ZoneRoadAccess, ZoneRoadDirection } from '@web-three-city/zone-core';

export type BuildingDefinitionId =
  | 'residential-cottage-1x1'
  | 'residential-rowhouse-1x2'
  | 'commercial-shop-1x1'
  | 'commercial-office-2x2'
  | 'industrial-workshop-1x2'
  | 'industrial-warehouse-2x2';

export type BuildingDefinitionVersion = 1;
export type BuildingRotationQuarterTurns = 0 | 1 | 2 | 3;
export type BuildingPrototypeId =
  | 'cottage'
  | 'rowhouse'
  | 'shop'
  | 'office'
  | 'workshop'
  | 'warehouse';
export type BuildingOperation = 'develop' | 'bulldoze';

export interface BuildingDefinition {
  readonly id: BuildingDefinitionId;
  readonly version: BuildingDefinitionVersion;
  readonly label: string;
  readonly footprintWidth: number;
  readonly footprintDepth: number;
  readonly allowedRotationQuarterTurns: readonly BuildingRotationQuarterTurns[];
  readonly compatibleZoneDefinitionIds: readonly ZoneDefinitionId[];
  readonly selectionPriority: number;
  readonly prototypeId: BuildingPrototypeId;
  readonly prototypeHeight: number;
}

export interface BuildingInstance {
  readonly instanceId: string;
  readonly buildingDefinitionId: BuildingDefinitionId;
  readonly buildingDefinitionVersion: BuildingDefinitionVersion;
  readonly originCell: CellCoord;
  readonly rotationQuarterTurns: BuildingRotationQuarterTurns;
}

export interface BuildingSnapshot {
  readonly revision: number;
  readonly instances: readonly BuildingInstance[];
}

export interface RotatedBuildingFootprint {
  readonly width: number;
  readonly depth: number;
}

export interface BuildingFrontage {
  readonly direction: ZoneRoadDirection;
  readonly distance: 1 | 2 | 3;
  readonly frontageCell: CellCoord;
  readonly roadCell: CellCoord;
}

export interface BuildingDevelopmentEnvironment {
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly roadRevision: number;
  readonly zoneRevision: number;
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile;
  isDry(cell: CellCoord): boolean;
  isRoadOccupied(cell: CellCoord): boolean;
  zoneDefinitionIdAt(cell: CellCoord): ZoneDefinitionId | null;
  roadAccessAt(cell: CellCoord): ZoneRoadAccess | null;
}

export type BuildingInvalidReason =
  | 'building:invalid-state'
  | 'building:invalid-environment'
  | 'building:invalid-cell'
  | 'building:no-change'
  | 'building:no-zoned-lot'
  | 'building:no-compatible-definition'
  | 'building:mixed-zone'
  | 'building:unsupported-terrain'
  | 'building:wet-cell'
  | 'building:road-occupied'
  | 'building:occupied'
  | 'building:road-access-required'
  | 'building:not-found';

export interface BuildingMutationPlan {
  readonly operation: BuildingOperation;
  readonly baseBuildingRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly baseRoadRevision: number;
  readonly baseZoneRevision: number;
  readonly requestedCell: CellCoord | null;
  readonly proposedInstances: readonly BuildingInstance[];
  readonly addedInstances: readonly BuildingInstance[];
  readonly removedInstances: readonly BuildingInstance[];
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: BuildingInvalidReason | null;
}

export interface BuildingMutationReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly operation: BuildingOperation;
  readonly addedInstanceCount: number;
  readonly removedInstanceCount: number;
  readonly addedCellCount: number;
  readonly removedCellCount: number;
  readonly dirtyChunks: readonly ChunkCoord[];
}

export type BuildingContractErrorCode =
  | 'building:invalid-plan'
  | 'building:stale-building-plan'
  | 'building:stale-terrain-plan'
  | 'building:stale-water-plan'
  | 'building:stale-road-plan'
  | 'building:stale-zone-plan'
  | 'building:incoherent-world-revision'
  | 'building:invalid-proposed-state';

export class BuildingContractError extends Error {
  readonly code: BuildingContractErrorCode;

  constructor(code: BuildingContractErrorCode) {
    super(code);
    this.name = 'BuildingContractError';
    this.code = code;
  }
}
