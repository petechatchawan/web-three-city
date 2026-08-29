export interface CellCoord {
  readonly x: number;
  readonly z: number;
}

export interface VertexCoord {
  readonly x: number;
  readonly z: number;
}

export interface ChunkCoord {
  readonly x: number;
  readonly z: number;
}

export interface WorldXZ {
  readonly x: number;
  readonly z: number;
}

export interface CellRect {
  readonly xStartInclusive: number;
  readonly zStartInclusive: number;
  readonly xEndExclusive: number;
  readonly zEndExclusive: number;
}

export interface CellWorldBounds {
  readonly xMinInclusive: number;
  readonly zMinInclusive: number;
  readonly xMaxExclusive: number;
  readonly zMaxExclusive: number;
}

export type RegionId = string & {
  readonly __regionIdFlavor?: "RegionId";
};

export type MapDefinitionId = string & {
  readonly __mapDefinitionIdFlavor?: "MapDefinitionId";
};

export interface StartingCandidate {
  readonly regionId: RegionId;
  readonly anchor: CellCoord;
}
