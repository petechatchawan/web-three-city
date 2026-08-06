import { describe, expect, it } from 'vitest';
import {
  planCreateDirectionalRelationship,
  planCreatePartnerRelationship,
  planEndPartnerRelationship,
} from '../src/index.js';
import {
  createPartneredHouseholdSnapshot,
  createSingleResidentSnapshot,
} from './population-fixtures.js';

describe('RCI Relationship planners', () => {
  it('creates a canonical partner record and consumes one sequence', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const withoutPartner = {
      ...snapshot,
      relationships: { revision: 0, relationships: [] },
      sequences: { ...snapshot.sequences, nextRelationship: 1 },
    };

    const plan = planCreatePartnerRelationship({
      snapshot: withoutPartner,
      firstCitizenId: 'citizen:2',
      secondCitizenId: 'citizen:1',
      startedAtTick: 10,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.relationships.relationships).toContainEqual({
      relationshipId: 'relationship:1',
      orientation: 'undirected',
      typeDefinitionId: 'relationship.partner',
      participantCitizenIds: ['citizen:1', 'citizen:2'],
      startedAtTick: 10,
      endedAtTick: null,
    });
    expect(plan.proposedSnapshot.sequences.nextRelationship).toBe(2);
  });

  it('rejects a second active partner without consuming a sequence', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const plan = planCreatePartnerRelationship({
      snapshot,
      firstCitizenId: 'citizen:1',
      secondCitizenId: 'citizen:2',
      startedAtTick: 20,
    });

    expect(plan.valid).toBe(false);
    expect(plan.invalidReason).toBe('rci:duplicate-active-partner');
    expect(plan.proposedSnapshot).toBe(snapshot);
    expect(plan.proposedSnapshot.sequences).toBe(snapshot.sequences);
  });

  it('ends an active partner while retaining immutable history', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const plan = planEndPartnerRelationship({
      snapshot,
      citizenId: 'citizen:2',
      endedAtTick: 21,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.relationships.relationships[0]).toEqual({
      ...snapshot.relationships.relationships[0],
      endedAtTick: 21,
    });
    expect(plan.proposedSnapshot.sequences.nextRelationship).toBe(
      snapshot.sequences.nextRelationship,
    );
  });

  it('creates a directional biological parent edge only when the parent is older', () => {
    const parent = createSingleResidentSnapshot();
    const childSnapshot = {
      ...parent,
      population: {
        ...parent.population,
        citizens: [
          ...parent.population.citizens,
          {
            citizenId: 'citizen:2',
            presence: 'resident' as const,
            sexDefinitionId: 'sex.male',
            bornAtTick: 0,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: null,
            diedAtTick: null,
          },
        ],
      },
      households: {
        ...parent.households,
        memberships: [
          ...parent.households.memberships,
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
        ...parent.sequences,
        nextCitizen: 3,
        nextHouseholdMembership: 3,
      },
    };

    const plan = planCreateDirectionalRelationship({
      snapshot: childSnapshot,
      typeDefinitionId: 'relationship.parent.biological.mother',
      sourceCitizenId: 'citizen:1',
      targetCitizenId: 'citizen:2',
      startedAtTick: 0,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.relationships.relationships[0]).toMatchObject({
      orientation: 'directional',
      sourceCitizenId: 'citizen:1',
      targetCitizenId: 'citizen:2',
    });

    const invalid = planCreateDirectionalRelationship({
      snapshot: childSnapshot,
      typeDefinitionId: 'relationship.parent.biological.mother',
      sourceCitizenId: 'citizen:2',
      targetCitizenId: 'citizen:1',
      startedAtTick: 0,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.invalidReason).toBe('rci:invalid-relationship');
  });
});
