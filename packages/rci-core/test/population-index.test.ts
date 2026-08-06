import { describe, expect, it } from 'vitest';
import {
  RciContractError,
  createInitialRciSnapshot,
  createRciCurrentStateIndex,
  type RciSnapshot,
} from '../src/index.js';

function populatedSnapshot(): RciSnapshot {
  const initial = createInitialRciSnapshot({ absoluteTick: 120 });
  return {
    ...initial,
    population: {
      ...initial.population,
      citizens: [
        {
          citizenId: 'citizen:2',
          presence: 'resident',
          sexDefinitionId: 'sex.male',
          bornAtTick: -20_000,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
        {
          citizenId: 'citizen:1',
          presence: 'resident',
          sexDefinitionId: 'sex.female',
          bornAtTick: -20_000,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
      ],
      qualifications: [
        {
          citizenQualificationId: 'citizen-qualification:2',
          citizenId: 'citizen:2',
          qualificationDefinitionId: 'qualification.skilled',
          awardedAtTick: 0,
          endedAtTick: null,
          sourceDefinitionId: 'qualification-source.fixture',
        },
        {
          citizenQualificationId: 'citizen-qualification:1',
          citizenId: 'citizen:1',
          qualificationDefinitionId: 'qualification.entry',
          awardedAtTick: 0,
          endedAtTick: null,
          sourceDefinitionId: 'qualification-source.fixture',
        },
      ],
    },
    relationships: {
      ...initial.relationships,
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
      ...initial.households,
      households: [
        {
          householdId: 'household:1',
          foundedAtTick: 0,
          dissolvedAtTick: null,
        },
      ],
      memberships: [
        {
          membershipId: 'household-membership:2',
          householdId: 'household:1',
          citizenId: 'citizen:2',
          startedAtTick: 0,
          endedAtTick: null,
          endReasonDefinitionId: null,
        },
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
      nextCitizen: 3,
      nextHousehold: 2,
      nextHouseholdMembership: 3,
      nextRelationship: 2,
      nextCitizenQualification: 3,
    },
  };
}

describe('RCI current-state indexes', () => {
  it('derives current Household, partner, and qualification state canonically', () => {
    const snapshot = populatedSnapshot();
    const index = createRciCurrentStateIndex(snapshot);

    expect(index.activeMembershipByCitizenId.get('citizen:1')?.membershipId).toBe(
      'household-membership:1',
    );
    expect(index.activeMemberIdsByHouseholdId.get('household:1')).toEqual([
      'citizen:1',
      'citizen:2',
    ]);
    expect(index.activePartnerByCitizenId.get('citizen:1')?.participantCitizenIds).toEqual([
      'citizen:1',
      'citizen:2',
    ]);
    expect(index.activeQualificationIdsByCitizenId.get('citizen:2')).toEqual([
      'qualification.skilled',
    ]);
    expect(Object.isFrozen(index.activeMemberIdsByHouseholdId.get('household:1'))).toBe(true);
  });

  it('rejects duplicate active membership authority', () => {
    const snapshot = populatedSnapshot();
    const duplicate: RciSnapshot = {
      ...snapshot,
      households: {
        ...snapshot.households,
        memberships: [
          ...snapshot.households.memberships,
          {
            membershipId: 'household-membership:3',
            householdId: 'household:1',
            citizenId: 'citizen:1',
            startedAtTick: 1,
            endedAtTick: null,
            endReasonDefinitionId: null,
          },
        ],
      },
    };

    expect(() => createRciCurrentStateIndex(duplicate)).toThrowError(
      new RciContractError('rci:duplicate-active-membership'),
    );
  });

  it('is independent of authoritative array order', () => {
    const snapshot = populatedSnapshot();
    const reversed: RciSnapshot = {
      ...snapshot,
      population: {
        ...snapshot.population,
        citizens: [...snapshot.population.citizens].reverse(),
        qualifications: [...snapshot.population.qualifications].reverse(),
      },
      households: {
        ...snapshot.households,
        memberships: [...snapshot.households.memberships].reverse(),
      },
    };

    const first = createRciCurrentStateIndex(snapshot);
    const second = createRciCurrentStateIndex(reversed);
    expect([...first.activeMemberIdsByHouseholdId]).toEqual([
      ...second.activeMemberIdsByHouseholdId,
    ]);
    expect([...first.activeQualificationIdsByCitizenId]).toEqual([
      ...second.activeQualificationIdsByCitizenId,
    ]);
  });
});
