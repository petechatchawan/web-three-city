import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  type RciSnapshot,
} from '../src/index.js';

export const testBuildings: BuildingSnapshot = Object.freeze({
  revision: 0,
  instances: Object.freeze([]),
});

export const testSimulationBefore: SimulationSnapshot = Object.freeze({
  revision: 4,
  absoluteTick: 31,
  growthSequence: 0,
});

export const testSimulationAfter: SimulationSnapshot = Object.freeze({
  revision: 5,
  absoluteTick: 32,
  growthSequence: 0,
});

export const testRegistries = createFoundationRciRegistries();

export function createPartneredHouseholdSnapshot(): RciSnapshot {
  const initial = createInitialRciSnapshot({
    absoluteTick: testSimulationBefore.absoluteTick,
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
          bornAtTick: -30 * 8_640,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
        {
          citizenId: 'citizen:2',
          presence: 'resident',
          sexDefinitionId: 'sex.male',
          bornAtTick: -32 * 8_640,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
      ],
      qualifications: [],
    },
    relationships: {
      revision: 1,
      relationships: [
        {
          relationshipId: 'relationship:1',
          orientation: 'undirected',
          typeDefinitionId: 'relationship.partner',
          participantCitizenIds: ['citizen:1', 'citizen:2'],
          startedAtTick: 0,
          endedAtTick: null,
        },
      ],
    },
    households: {
      revision: 1,
      households: [
        {
          householdId: 'household:1',
          foundedAtTick: 0,
          dissolvedAtTick: null,
        },
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
        {
          membershipId: 'household-membership:2',
          householdId: 'household:1',
          citizenId: 'citizen:2',
          startedAtTick: 0,
          endedAtTick: null,
          endReasonDefinitionId: null,
        },
      ],
    },
    sequences: {
      ...initial.sequences,
      nextCitizen: 3,
      nextHousehold: 2,
      nextHouseholdMembership: 3,
      nextRelationship: 2,
    },
  };
}

export function createSingleResidentSnapshot(): RciSnapshot {
  const partnered = createPartneredHouseholdSnapshot();
  return {
    ...partnered,
    population: {
      ...partnered.population,
      citizens: [partnered.population.citizens[0]!],
    },
    relationships: { ...partnered.relationships, relationships: [] },
    households: {
      ...partnered.households,
      memberships: [partnered.households.memberships[0]!],
    },
    sequences: {
      ...partnered.sequences,
      nextCitizen: 2,
      nextHouseholdMembership: 2,
      nextRelationship: 1,
    },
  };
}
