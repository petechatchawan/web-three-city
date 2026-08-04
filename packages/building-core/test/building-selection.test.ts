import { describe, expect, it, vi } from 'vitest';
import {
  buildingDefinitionForId,
  selectBuildingCandidate,
  stableBuildingSelectionHash,
  type BuildingSelectionCandidate,
} from '../src/index.js';

function candidate(id: 'commercial-shop-1x1' | 'commercial-cafe-1x1'): BuildingSelectionCandidate {
  const definition = buildingDefinitionForId(id);
  return Object.freeze({
    definition,
    instance: Object.freeze({
      instanceId: 'candidate',
      buildingDefinitionId: definition.id,
      buildingDefinitionVersion: 1,
      originCell: Object.freeze({ x: 2, z: 3 }),
      rotationQuarterTurns: 0,
    }),
    frontage: Object.freeze({
      direction: 'south',
      distance: 1,
      frontageCell: Object.freeze({ x: 2, z: 3 }),
      roadCell: Object.freeze({ x: 2, z: 4 }),
    }),
  });
}

describe('deterministic Building variety selection', () => {
  it('hashes equal authority to the same unsigned value without random input', () => {
    const random = vi.spyOn(Math, 'random');
    const context = {
      absoluteTick: 24,
      growthSequence: 1,
      originCell: { x: 2, z: 3 },
      zoneDefinitionId: 'commercial',
    };
    expect(stableBuildingSelectionHash(context)).toBe(stableBuildingSelectionHash(context));
    expect(stableBuildingSelectionHash(context)).toBeGreaterThanOrEqual(0);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('avoids an adjacent duplicate when another valid definition exists', () => {
    const selected = selectBuildingCandidate(
      [candidate('commercial-shop-1x1'), candidate('commercial-cafe-1x1')],
      {
        absoluteTick: 24,
        growthSequence: 1,
        originCell: { x: 2, z: 3 },
        zoneDefinitionId: 'commercial',
        adjacentDefinitionIds: new Set(['commercial-shop-1x1']),
      },
    );
    expect(selected?.definition.id).toBe('commercial-cafe-1x1');
  });
});
