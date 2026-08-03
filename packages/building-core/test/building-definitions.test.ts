import { describe, expect, it } from 'vitest';
import { buildingDefinitionForId, buildingDefinitions } from '../src/index.js';

describe('building definitions', () => {
  it('provides six immutable versioned definitions with strict zone compatibility', () => {
    const definitions = buildingDefinitions();
    expect(definitions).toHaveLength(6);
    expect(new Set(definitions.map((entry) => entry.id)).size).toBe(6);
    for (const definition of definitions) {
      expect(definition.version).toBe(1);
      expect(definition.compatibleZoneDefinitionIds).toHaveLength(1);
      expect(definition.allowedRotationQuarterTurns).toEqual([0, 1, 2, 3]);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.compatibleZoneDefinitionIds)).toBe(true);
    }
  });

  it('fails closed for an unknown definition', () => {
    expect(() => buildingDefinitionForId('missing' as never)).toThrow(
      'building-definition:unknown-id',
    );
  });
});
