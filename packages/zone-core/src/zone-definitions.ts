import {
  COMMERCIAL_ZONE_CODE,
  EMPTY_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  type ZoneDefinition,
  type ZoneDefinitionCode,
  type ZoneDefinitionId,
} from './contracts.js';

export const RESIDENTIAL_ZONE_DEFINITION: ZoneDefinition = Object.freeze({
  id: 'residential',
  code: RESIDENTIAL_ZONE_CODE,
  label: 'Residential',
});

export const COMMERCIAL_ZONE_DEFINITION: ZoneDefinition = Object.freeze({
  id: 'commercial',
  code: COMMERCIAL_ZONE_CODE,
  label: 'Commercial',
});

export const INDUSTRIAL_ZONE_DEFINITION: ZoneDefinition = Object.freeze({
  id: 'industrial',
  code: INDUSTRIAL_ZONE_CODE,
  label: 'Industrial',
});

export function zoneDefinitionForId(id: ZoneDefinitionId): ZoneDefinition {
  switch (id) {
    case 'residential':
      return RESIDENTIAL_ZONE_DEFINITION;
    case 'commercial':
      return COMMERCIAL_ZONE_DEFINITION;
    case 'industrial':
      return INDUSTRIAL_ZONE_DEFINITION;
    default:
      throw new RangeError('zone-definition:unknown-id');
  }
}

export function zoneDefinitionForCode(code: ZoneDefinitionCode): ZoneDefinition | null {
  switch (code) {
    case EMPTY_ZONE_CODE:
      return null;
    case RESIDENTIAL_ZONE_CODE:
      return RESIDENTIAL_ZONE_DEFINITION;
    case COMMERCIAL_ZONE_CODE:
      return COMMERCIAL_ZONE_DEFINITION;
    case INDUSTRIAL_ZONE_CODE:
      return INDUSTRIAL_ZONE_DEFINITION;
    default:
      throw new RangeError('zone-definition:unknown-code');
  }
}
