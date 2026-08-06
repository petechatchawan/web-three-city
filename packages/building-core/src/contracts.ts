import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import type { ChunkCoord, TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import type {
  ZoneDefinitionId,
  ZoneRoadAccess,
  ZoneRoadDirection,
} from '@web-three-city/zone-core';

export type BuildingDefinitionId =
  | 'residential-cottage-1x1'
  | 'residential-rowhouse-1x2'
  | 'residential-duplex-2x1'
  | 'residential-apartment-2x2'
  | 'commercial-shop-1x1'
  | 'commercial-cafe-1x1'
  | 'commercial-market-1x2'
  | 'commercial-office-2x2'
  | 'industrial-workshop-1x2'
  | 'industrial-depot-1x1'
  | 'industrial-warehouse-2x2'
  | 'industrial-factory-2x2';

export type BuildingDefinitionVersion = 1;
export type BuildingRotationQuarterTurns = 0 | 1 | 2 | 3;
export type BuildingPrototypeId =
  | 'cottage'
  | 'rowhouse'
  | 'duplex'
  | 'apartment'
  | 'shop'
  | 'cafe'
  | 'market'
  | 'office'
  | 'workshop'
  | 'depot'
  | 'warehouse'
  | 'factory';
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
  readonly selectionWeight: number;
  readonly constructionDurationTicks: number;
  readonly prototypeId: BuildingPrototypeId;
  readonly prototypeHeight: number;
  readonly capacityProfileDefinitionId: string;
}

export interface BuildingInstanceBase {
  readonly instanceId: string;
  readonly buildingDefinitionId: BuildingDefinitionId;
  readonly buildingDefinitionVersion: BuildingDefinitionVersion;
  readonly originCell: CellCoord;
  readonly rotationQuarterTurns: BuildingRotationQuarterTurns;
}
export interface LegacyBuildingInstance extends BuildingInstanceBase { readonly lifecycle?: never }
export interface ConstructionBuildingInstance extends BuildingInstanceBase {
  readonly lifecycle: 'construction';
  readonly constructionStartedAtTick: number;
  readonly constructionCompletesAtTick: number;
}
export interface ActiveBuildingInstance extends BuildingInstanceBase {
  readonly lifecycle: 'active';
  readonly activatedAtTick: number;
}
export type BuildingInstance = LegacyBuildingInstance | ConstructionBuildingInstance | ActiveBuildingInstance;
export type AuthoritativeBuildingInstance = ConstructionBuildingInstance | ActiveBuildingInstance;
export interface BuildingSnapshot { readonly revision: number; readonly instances: readonly BuildingInstance[] }
export interface RotatedBuildingFootprint { readonly width: number; readonly depth: number }
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
export type BuildingGrowthInvalidReason =
  | 'building-growth:invalid-building-state'
  | 'building-growth:invalid-simulation-state'
  | 'building-growth:invalid-environment'
  | 'building-growth:tick-overflow';
export interface BuildingGrowthPlan {
  readonly baseBuildingRevision: number;
  readonly baseSimulationRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly baseRoadRevision: number;
  readonly baseZoneRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly proposedInstances: readonly BuildingInstance[];
  readonly startedInstanceIds: readonly string[];
  readonly completedInstanceIds: readonly string[];
  readonly nextGrowthSequence: number;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: BuildingGrowthInvalidReason | null;
}
export interface BuildingGrowthReceipt {
  readonly beforeBuildingRevision: number;
  readonly afterBuildingRevision: number;
  readonly beforeSimulationRevision: number;
  readonly afterSimulationRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly startedInstanceIds: readonly string[];
  readonly completedInstanceIds: readonly string[];
  readonly dirtyChunks: readonly ChunkCoord[];
}
export interface BuildingGrowthInput {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
}
export type BuildingContractErrorCode =
  | 'building:invalid-plan'
  | 'building:stale-building-plan'
  | 'building:stale-terrain-plan'
  | 'building:stale-water-plan'
  | 'building:stale-road-plan'
  | 'building:stale-zone-plan'
  | 'building:incoherent-world-revision'
  | 'building:invalid-proposed-state'
  | 'building-growth:invalid-plan'
  | 'building-growth:stale-simulation-plan';
export class BuildingContractError extends Error {
  readonly code: BuildingContractErrorCode;
  constructor(code: BuildingContractErrorCode) {
    super(code);
    this.name = 'BuildingContractError';
    this.code = code;
  }
}
