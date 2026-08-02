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
