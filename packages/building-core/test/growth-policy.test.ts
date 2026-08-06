import { describe, expect, it } from 'vitest';
import { OPEN_BUILDING_GROWTH_POLICY, validateBuildingGrowthPolicy } from '../src/index.js';

describe('Building Growth policy', () => {
  it('preserves open-growth compatibility by default', () => {
    expect(OPEN_BUILDING_GROWTH_POLICY.allowsZone('residential')).toBe(true);
    expect(OPEN_BUILDING_GROWTH_POLICY.zoneWeightMilli('commercial')).toBe(1_000);
    expect(() => validateBuildingGrowthPolicy(OPEN_BUILDING_GROWTH_POLICY)).not.toThrow();
  });

  it('rejects non-zero weight for a closed channel', () => {
    expect(() =>
      validateBuildingGrowthPolicy({
        policyRevision: 1,
        allowsZone: () => false,
        zoneWeightMilli: () => 1,
      }),
    ).toThrow('building-growth:invalid-policy');
  });
});
