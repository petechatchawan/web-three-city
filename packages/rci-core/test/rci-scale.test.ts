import { describe, expect, it } from 'vitest';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  createRciProjection,
  encodeRciSaveV1,
} from '../src/index.js';

function scaleSnapshot() {
  const absoluteTick = 32;
  const initial = createInitialRciSnapshot({ absoluteTick, deterministicSeed: 101 });
  const citizens = Array.from({ length: 5_000 }, (_, index) => ({
    citizenId: `citizen:${index + 1}`,
    presence: 'resident' as const,
    sexDefinitionId: index % 2 === 0 ? 'sex.female' : 'sex.male',
    bornAtTick: absoluteTick - (18 + (index % 47)) * 8_640,
    movedIntoCityAtTick: 0,
    movedOutOfCityAtTick: null,
    diedAtTick: null,
  }));
  const households = Array.from({ length: 1_250 }, (_, index) => ({
    householdId: `household:${index + 1}`,
    foundedAtTick: 0,
    dissolvedAtTick: null,
  }));
  const memberships = citizens.map((citizen, index) => ({
    membershipId: `household-membership:${index + 1}`,
    householdId: `household:${Math.floor(index / 4) + 1}`,
    citizenId: citizen.citizenId,
    startedAtTick: 0,
    endedAtTick: null,
    endReasonDefinitionId: null,
  }));
  const qualifications = citizens.map((citizen, index) => ({
    citizenQualificationId: `citizen-qualification:${index + 1}`,
    citizenId: citizen.citizenId,
    qualificationDefinitionId:
      index % 3 === 0
        ? 'qualification.professional'
        : index % 3 === 1
          ? 'qualification.skilled'
          : 'qualification.entry',
    awardedAtTick: 0,
    endedAtTick: null,
    sourceDefinitionId: 'scale-fixture',
  }));
  return {
    ...initial,
    population: { revision: 1, citizens, qualifications },
    households: { revision: 1, households, memberships },
    sequences: {
      ...initial.sequences,
      nextCitizen: 5_001,
      nextHousehold: 1_251,
      nextHouseholdMembership: 5_001,
      nextCitizenQualification: 5_001,
    },
  };
}

describe('RCI 5,000 Citizen scale baseline', () => {
  it('rebuilds projections and canonical Save deterministically within a generous CI budget', () => {
    const snapshot = scaleSnapshot();
    const registries = createFoundationRciRegistries();
    const startedAt = Date.now();
    const firstProjection = createRciProjection(snapshot, registries, 32);
    const firstSave = encodeRciSaveV1(snapshot);
    const secondProjection = createRciProjection(snapshot, registries, 32);
    const secondSave = encodeRciSaveV1(snapshot);
    const elapsedMs = Date.now() - startedAt;

    expect(firstProjection).toEqual(secondProjection);
    expect(firstProjection.population.residentCount).toBe(5_000);
    expect(firstProjection.population.householdCount).toBe(1_250);
    expect(firstSave).toEqual(secondSave);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
