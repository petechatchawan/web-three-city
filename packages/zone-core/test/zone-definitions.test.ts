import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ZONE_CODE,
  COMMERCIAL_ZONE_DEFINITION,
  EMPTY_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  INDUSTRIAL_ZONE_DEFINITION,
  RESIDENTIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_DEFINITION,
  zoneDefinitionForCode,
  zoneDefinitionForId,
} from '../src/index.js';

describe('Zone definitions', () => {
  it('exposes stable frozen definitions and deterministic lookup', () => {
    expect(RESIDENTIAL_ZONE_DEFINITION).toEqual({
      id: 'residential',
      code: RESIDENTIAL_ZONE_CODE,
      label: 'Residential',
    });
    expect(COMMERCIAL_ZONE_DEFINITION).toEqual({
      id: 'commercial',
      code: COMMERCIAL_ZONE_CODE,
      label: 'Commercial',
    });
    expect(INDUSTRIAL_ZONE_DEFINITION).toEqual({
      id: 'industrial',
      code: INDUSTRIAL_ZONE_CODE,
      label: 'Industrial',
    });
    expect(Object.isFrozen(RESIDENTIAL_ZONE_DEFINITION)).toBe(true);
    expect(zoneDefinitionForCode(EMPTY_ZONE_CODE)).toBeNull();
    expect(zoneDefinitionForCode(RESIDENTIAL_ZONE_CODE)).toBe(RESIDENTIAL_ZONE_DEFINITION);
    expect(zoneDefinitionForCode(COMMERCIAL_ZONE_CODE)).toBe(COMMERCIAL_ZONE_DEFINITION);
    expect(zoneDefinitionForCode(INDUSTRIAL_ZONE_CODE)).toBe(INDUSTRIAL_ZONE_DEFINITION);
    expect(zoneDefinitionForId('residential')).toBe(RESIDENTIAL_ZONE_DEFINITION);
    expect(zoneDefinitionForId('commercial')).toBe(COMMERCIAL_ZONE_DEFINITION);
    expect(zoneDefinitionForId('industrial')).toBe(INDUSTRIAL_ZONE_DEFINITION);
  });

  it('rejects unknown ids and codes', () => {
    expect(() => zoneDefinitionForId('mixed-use' as never)).toThrow('zone-definition:unknown-id');
    expect(() => zoneDefinitionForCode(4 as never)).toThrow('zone-definition:unknown-code');
  });
});
