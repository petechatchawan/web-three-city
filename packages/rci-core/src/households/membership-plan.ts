import {
  invalidRecordMutationPlan,
  validRecordMutationPlan,
  type RciRecordMutationPlan,
} from '../contracts/mutation-plan.js';
import type { CitizenId, HouseholdId } from '../contracts/ids.js';
import type { HouseholdMembershipRecord } from '../contracts/records.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function planStartHouseholdMembership(input: Readonly<{
  snapshot: RciSnapshot;
  householdId: HouseholdId;
  citizenId: CitizenId;
  startedAtTick: number;
}>): RciRecordMutationPlan {
  const { snapshot } = input;
  const citizen = snapshot.population.citizens.find(
    (candidate) => candidate.citizenId === input.citizenId,
  );
  const household = snapshot.households.households.find(
    (candidate) => candidate.householdId === input.householdId,
  );
  const existing = snapshot.households.memberships.find(
    (membership) => membership.citizenId === input.citizenId && membership.endedAtTick === null,
  );
  if (existing !== undefined) {
    return invalidRecordMutationPlan(snapshot, 'rci:duplicate-active-membership');
  }
  if (
    citizen === undefined ||
    citizen.presence !== 'resident' ||
    household === undefined ||
    household.dissolvedAtTick !== null ||
    !Number.isSafeInteger(input.startedAtTick) ||
    input.startedAtTick < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-state');
  }

  const membership: HouseholdMembershipRecord = Object.freeze({
    membershipId: `household-membership:${snapshot.sequences.nextHouseholdMembership}`,
    householdId: input.householdId,
    citizenId: input.citizenId,
    startedAtTick: input.startedAtTick,
    endedAtTick: null,
    endReasonDefinitionId: null,
  });
  const proposed = canonicalizeRciSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    households: {
      revision: snapshot.households.revision + 1,
      households: snapshot.households.households,
      memberships: [...snapshot.households.memberships, membership],
    },
    sequences: {
      ...snapshot.sequences,
      nextHouseholdMembership: snapshot.sequences.nextHouseholdMembership + 1,
    },
  });
  return validRecordMutationPlan(snapshot, proposed);
}

export function planEndHouseholdMembership(input: Readonly<{
  snapshot: RciSnapshot;
  citizenId: CitizenId;
  endedAtTick: number;
  endReasonDefinitionId: string;
}>): RciRecordMutationPlan {
  const { snapshot } = input;
  const active = snapshot.households.memberships.find(
    (membership) => membership.citizenId === input.citizenId && membership.endedAtTick === null,
  );
  if (
    active === undefined ||
    input.endReasonDefinitionId.length === 0 ||
    !Number.isSafeInteger(input.endedAtTick) ||
    input.endedAtTick < active.startedAtTick
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-state');
  }

  const memberships = snapshot.households.memberships.map((membership) =>
    membership.membershipId === active.membershipId
      ? Object.freeze({
          ...membership,
          endedAtTick: input.endedAtTick,
          endReasonDefinitionId: input.endReasonDefinitionId,
        })
      : membership,
  );
  const hasRemainingActiveMember = memberships.some(
    (membership) =>
      membership.householdId === active.householdId && membership.endedAtTick === null,
  );
  const households = snapshot.households.households.map((household) =>
    household.householdId === active.householdId && !hasRemainingActiveMember
      ? Object.freeze({ ...household, dissolvedAtTick: input.endedAtTick })
      : household,
  );
  const proposed = canonicalizeRciSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    households: {
      revision: snapshot.households.revision + 1,
      households,
      memberships,
    },
  });
  return validRecordMutationPlan(snapshot, proposed);
}
