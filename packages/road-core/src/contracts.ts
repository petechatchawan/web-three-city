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
