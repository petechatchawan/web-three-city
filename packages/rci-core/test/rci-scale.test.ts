import { describe, expect, it } from 'vitest';
import {
  ageOriginMacroHour,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  createRciProjection,
  encodeRciSaveV1,
} from '../src/index.js';
import { macroHour } from './temporal-fixtures.js';

function scaleSnapshot() {
  const absoluteMacroHourIndex = macroHour(32);
  const initial = createInitialRciSnapshot({ absoluteMacroHourIndex, deterministicSeed: 101 });
  const citizens = Array.from({ length: 5_000 }, (_, index) => ({
    citizenId: `citizen:${index + 1}`,
    presence: 'resident' as const,
    sexDefinitionId: index % 2 === 0 ? 'sex.female' : 'sex.male',
    bornAtMacroHourIndex: ageOriginMacroHour(32 - (18 + (index % 47)) * 288),
    movedIntoCityAtMacroHourIndex: macroHour(0),
    movedOutOfCityAtMacroHourIndex: null,
    diedAtMacroHourIndex: null,
  }));
  const households = Array.from({ length: 1_250 }, (_, index) => ({
    householdId: `household:${index + 1}`,
    foundedAtMacroHourIndex: macroHour(0),
    dissolvedAtMacroHourIndex: null,
  }));
  const memberships = citizens.map((citizen, index) => ({
    membershipId: `household-membership:${index + 1}`,
    householdId: `household:${Math.floor(index / 4) + 1}`,
    citizenId: citizen.citizenId,
    startedAtMacroHourIndex: macroHour(0),
    endedAtMacroHourIndex: null,
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
    awardedAtMacroHourIndex: macroHour(0),
    endedAtMacroHourIndex: null,
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
    const firstProjection = createRciProjection(snapshot, registries, macroHour(32));
    const firstSave = encodeRciSaveV1(snapshot);
    const secondProjection = createRciProjection(snapshot, registries, macroHour(32));
    const secondSave = encodeRciSaveV1(snapshot);
    const elapsedMs = Date.now() - startedAt;

    expect(firstProjection).toEqual(secondProjection);
    expect(firstProjection.population.residentCount).toBe(5_000);
    expect(firstProjection.population.householdCount).toBe(1_250);
    expect(firstSave).toEqual(secondSave);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
