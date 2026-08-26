import type { BuildingSnapshot } from '@web-three-city/building-core';
import { macroHourIndex } from '@web-three-city/simulation-core';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  type RciSnapshot,
} from '../src/index.js';
import { ageOriginMacroHour, macroHour } from './temporal-fixtures.js';

export const housingRegistries = createFoundationRciRegistries();

export const activeCottageBuildings: BuildingSnapshot = Object.freeze({
  revision: 1,
  instances: Object.freeze([
    Object.freeze({
      instanceId: 'building:growth:1',
      buildingDefinitionId: 'residential-cottage-1x1',
      buildingDefinitionVersion: 1,
      originCell: Object.freeze({ x: 1, z: 1 }),
      rotationQuarterTurns: 0,
      lifecycle: 'active',
      activatedAtMacroHourIndex: macroHourIndex(24),
    }),
  ]),
});

export function residentHouseholdSnapshot(absoluteMacroHour = 32): RciSnapshot {
  const initial = createInitialRciSnapshot({
    absoluteMacroHourIndex: macroHour(absoluteMacroHour),
    deterministicSeed: 7,
  });
  return {
    ...initial,
    population: {
      revision: 1,
      citizens: [
        {
          citizenId: 'citizen:1',
          presence: 'resident',
          sexDefinitionId: 'sex.female',
          bornAtMacroHourIndex: ageOriginMacroHour(absoluteMacroHour - 30 * 288),
          movedIntoCityAtMacroHourIndex: macroHour(0),
          movedOutOfCityAtMacroHourIndex: null,
          diedAtMacroHourIndex: null,
        },
      ],
      qualifications: [
        {
          citizenQualificationId: 'citizen-qualification:1',
          citizenId: 'citizen:1',
          qualificationDefinitionId: 'qualification.skilled',
          awardedAtMacroHourIndex: macroHour(0),
          endedAtMacroHourIndex: null,
          sourceDefinitionId: 'fixture',
        },
      ],
    },
    households: {
      revision: 1,
      households: [
        {
          householdId: 'household:1',
          foundedAtMacroHourIndex: macroHour(0),
          dissolvedAtMacroHourIndex: null,
        },
      ],
      memberships: [
        {
          membershipId: 'household-membership:1',
          householdId: 'household:1',
          citizenId: 'citizen:1',
          startedAtMacroHourIndex: macroHour(0),
          endedAtMacroHourIndex: null,
          endReasonDefinitionId: null,
        },
      ],
    },
    sequences: {
      ...initial.sequences,
      nextCitizen: 2,
      nextHousehold: 2,
      nextHouseholdMembership: 2,
      nextCitizenQualification: 2,
    },
  };
}
