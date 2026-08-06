import { describe, expect, it } from 'vitest';
import { planEndHouseholdMembership, planStartHouseholdMembership } from '../src/index.js';
import {
  createPartneredHouseholdSnapshot,
  createSingleResidentSnapshot,
} from './population-fixtures.js';

describe('RCI Household membership planners', () => {
  it('starts one active membership after complete validation', () => {
    const snapshot = createSingleResidentSnapshot();
    const withoutMembership = {
      ...snapshot,
      households: {
        ...snapshot.households,
        memberships: [],
      },
      sequences: {
        ...snapshot.sequences,
        nextHouseholdMembership: 1,
      },
    };

    const plan = planStartHouseholdMembership({
      snapshot: withoutMembership,
      householdId: 'household:1',
      citizenId: 'citizen:1',
      startedAtTick: 10,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.households.memberships).toContainEqual({
      membershipId: 'household-membership:1',
      householdId: 'household:1',
      citizenId: 'citizen:1',
      startedAtTick: 10,
      endedAtTick: null,
      endReasonDefinitionId: null,
    });
    expect(plan.proposedSnapshot.sequences.nextHouseholdMembership).toBe(2);
  });

  it('rejects overlapping active membership without consuming a sequence', () => {
    const snapshot = createSingleResidentSnapshot();
    const plan = planStartHouseholdMembership({
      snapshot,
      householdId: 'household:1',
      citizenId: 'citizen:1',
      startedAtTick: 10,
    });

    expect(plan.valid).toBe(false);
    expect(plan.invalidReason).toBe('rci:duplicate-active-membership');
    expect(plan.proposedSnapshot).toBe(snapshot);
    expect(plan.proposedSnapshot.sequences).toBe(snapshot.sequences);
  });

  it('ends membership and dissolves the Household after its final resident leaves', () => {
    const snapshot = createSingleResidentSnapshot();
    const plan = planEndHouseholdMembership({
      snapshot,
      citizenId: 'citizen:1',
      endedAtTick: 20,
      endReasonDefinitionId: 'household-membership-ended.fixture',
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.households.memberships[0]).toEqual({
      ...snapshot.households.memberships[0],
      endedAtTick: 20,
      endReasonDefinitionId: 'household-membership-ended.fixture',
    });
    expect(plan.proposedSnapshot.households.households[0]).toEqual({
      ...snapshot.households.households[0],
      dissolvedAtTick: 20,
    });
  });

  it('keeps the Household active while another resident remains', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const plan = planEndHouseholdMembership({
      snapshot,
      citizenId: 'citizen:1',
      endedAtTick: 20,
      endReasonDefinitionId: 'household-membership-ended.fixture',
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.households.households[0]?.dissolvedAtTick).toBeNull();
  });
});
