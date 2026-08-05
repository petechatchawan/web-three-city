import { buildingDefinitions } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createBuildingMaterials, createBuildingPrototype } from '../src/index.js';

describe('Building active prototype variety', () => {
  it('creates a distinct prototype for all twelve definitions', () => {
    const materials = createBuildingMaterials();
    const seen = new Set<string>();
    for (const definition of buildingDefinitions()) {
      const group = createBuildingPrototype(
        {
          instanceId: definition.id,
          buildingDefinitionId: definition.id,
          buildingDefinitionVersion: definition.version,
          originCell: { x: 0, z: 0 },
          rotationQuarterTurns: 0,
          lifecycle: 'active',
          activatedAtTick: 8,
        },
        materials,
        WORLD_CONFIG,
      );
      expect(group.children.length).toBeGreaterThan(0);
      seen.add(definition.prototypeId);
    }
    expect(seen.size).toBe(12);
    materials.dispose();
  });
});
