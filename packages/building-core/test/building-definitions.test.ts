import { describe, expect, it } from 'vitest';
import { buildingDefinitionForId, buildingDefinitions } from '../src/index.js';

const EXPECTED_IDS = [
  'commercial-cafe-1x1',
  'commercial-market-1x2',
  'commercial-office-2x2',
  'commercial-shop-1x1',
  'industrial-depot-1x1',
  'industrial-factory-2x2',
  'industrial-warehouse-2x2',
  'industrial-workshop-1x2',
  'residential-apartment-2x2',
  'residential-cottage-1x1',
  'residential-duplex-2x1',
  'residential-rowhouse-1x2',
];

describe('building definitions', () => {
  it('provides the exact immutable twelve-definition catalog', () => {
    const definitions = buildingDefinitions();
    expect(definitions.map((entry) => entry.id).sort()).toEqual(EXPECTED_IDS);
    for (const definition of definitions) {
      expect(definition.version).toBe(1);
      expect(definition.compatibleZoneDefinitionIds).toHaveLength(1);
      expect(definition.allowedRotationQuarterTurns).toEqual([0, 1, 2, 3]);
      expect(definition.selectionWeight).toBeGreaterThan(0);
      expect(definition.constructionDurationTicks).toBe(
        24 * definition.footprintWidth * definition.footprintDepth,
      );
      expect(definition.capacityProfileDefinitionId).toMatch(
        /^capacity\.(residential|commercial|industrial)\.[a-z0-9-]+\.v1$/,
      );
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });

  it('maps the approved residential capacity profiles', () => {
    expect(buildingDefinitionForId('residential-cottage-1x1').capacityProfileDefinitionId).toBe(
      'capacity.residential.cottage.v1',
    );
    expect(buildingDefinitionForId('residential-rowhouse-1x2').capacityProfileDefinitionId).toBe(
      'capacity.residential.rowhouse.v1',
    );
    expect(buildingDefinitionForId('residential-duplex-2x1').capacityProfileDefinitionId).toBe(
      'capacity.residential.duplex.v1',
    );
    expect(buildingDefinitionForId('residential-apartment-2x2').capacityProfileDefinitionId).toBe(
      'capacity.residential.apartment.v1',
    );
  });

  it('fails closed for an unknown definition', () => {
    expect(() => buildingDefinitionForId('missing' as never)).toThrow(
      'building-definition:unknown-id',
    );
  });
});
