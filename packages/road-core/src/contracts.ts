export const EMPTY_ROAD_CODE = 0 as const;
export const BASIC_ROAD_CODE = 1 as const;

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

export interface RoadSnapshot {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}
