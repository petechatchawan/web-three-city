import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  type RciSnapshot,
} from '../src/index.js';

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
      activatedAtTick: 24,
    }),
  ]),
});

export function residentHouseholdSnapshot(absoluteTick = 32): RciSnapshot {
  const initial = createInitialRciSnapshot({ absoluteTick, deterministicSeed: 7 });
  return {
    ...initial,
    population: {
      revision: 1,
      citizens: [
        {
          citizenId: 'citizen:1',
          presence: 'resident',
          sexDefinitionId: 'sex.female',
          bornAtTick: absoluteTick - 30 * 8_640,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
      ],
      qualifications: [
        {
          citizenQualificationId: 'citizen-qualification:1',
          citizenId: 'citizen:1',
          qualificationDefinitionId: 'qualification.skilled',
          awardedAtTick: 0,
          endedAtTick: null,
          sourceDefinitionId: 'fixture',
        },
      ],
    },
    households: {
      revision: 1,
      households: [
        { householdId: 'household:1', foundedAtTick: 0, dissolvedAtTick: null },
      ],
      memberships: [
        {
          membershipId: 'household-membership:1',
          householdId: 'household:1',
          citizenId: 'citizen:1',
          startedAtTick: 0,
          endedAtTick: null,
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
