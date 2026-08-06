import { describe, expect, it } from 'vitest';
import {
  createFoundationRciRegistries,
  residentialCapacityProfileForId,
} from '../src/index.js';

describe('residential capacity profiles', () => {
  it.each([
    ['capacity.residential.cottage.v1', 1, 4],
    ['capacity.residential.rowhouse.v1', 1, 5],
    ['capacity.residential.duplex.v1', 2, 4],
    ['capacity.residential.apartment.v1', 6, 3],
  ] as const)('locks %s', (id, unitCount, capacityPerUnit) => {
    const profile = residentialCapacityProfileForId(
      createFoundationRciRegistries().capacityProfiles,
      id,
    );
    expect(profile.dwellingUnitCount).toBe(unitCount);
    expect(profile.residentCapacityPerUnit).toBe(capacityPerUnit);
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('rejects a workplace profile at the housing boundary', () => {
    expect(() =>
      residentialCapacityProfileForId(
        createFoundationRciRegistries().capacityProfiles,
        'capacity.commercial.shop.v1',
      ),
    ).toThrow('rci:unknown-definition');
  });
});
