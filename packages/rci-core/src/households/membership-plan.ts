import {
  compareMacroHours,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import {
  invalidRecordMutationPlan,
  validRecordMutationPlan,
  type RciRecordMutationPlan,
} from '../contracts/mutation-plan.js';
import type { CitizenId, HouseholdId } from '../contracts/ids.js';
import type { HouseholdMembershipRecord } from '../contracts/records.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function planStartHouseholdMembership(
  input: Readonly<{
    snapshot: RciSnapshot;
    householdId: HouseholdId;
    citizenId: CitizenId;
    startedAtMacroHourIndex: MacroHourIndex;
  }>,
): RciRecordMutationPlan {
  const { snapshot } = input;
  const citizen = snapshot.population.citizens.find(
    (candidate) => candidate.citizenId === input.citizenId,
  );
  const household = snapshot.households.households.find(
    (candidate) => candidate.householdId === input.householdId,
  );
  const existing = snapshot.households.memberships.find(
    (membership) =>
      membership.citizenId === input.citizenId && membership.endedAtMacroHourIndex === null,
  );
  if (existing !== undefined) {
    return invalidRecordMutationPlan(snapshot, 'rci:duplicate-active-membership');
  }
  if (
    citizen === undefined ||
    citizen.presence !== 'resident' ||
    household === undefined ||
    household.dissolvedAtMacroHourIndex !== null ||
    !Number.isSafeInteger(macroHourValue(input.startedAtMacroHourIndex)) ||
    macroHourValue(input.startedAtMacroHourIndex) < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-state');
  }

  const membership: HouseholdMembershipRecord = Object.freeze({
    membershipId: `household-membership:${snapshot.sequences.nextHouseholdMembership}`,
    householdId: input.householdId,
    citizenId: input.citizenId,
    startedAtMacroHourIndex: input.startedAtMacroHourIndex,
    endedAtMacroHourIndex: null,
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

export function planEndHouseholdMembership(
  input: Readonly<{
    snapshot: RciSnapshot;
    citizenId: CitizenId;
    endedAtMacroHourIndex: MacroHourIndex;
    endReasonDefinitionId: string;
  }>,
): RciRecordMutationPlan {
  const { snapshot } = input;
  const active = snapshot.households.memberships.find(
    (membership) =>
      membership.citizenId === input.citizenId && membership.endedAtMacroHourIndex === null,
  );
  if (
    active === undefined ||
    input.endReasonDefinitionId.length === 0 ||
    !Number.isSafeInteger(macroHourValue(input.endedAtMacroHourIndex)) ||
    compareMacroHours(input.endedAtMacroHourIndex, active.startedAtMacroHourIndex) < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-state');
  }

  const memberships = snapshot.households.memberships.map((membership) =>
    membership.membershipId === active.membershipId
      ? Object.freeze({
          ...membership,
          endedAtMacroHourIndex: input.endedAtMacroHourIndex,
          endReasonDefinitionId: input.endReasonDefinitionId,
        })
      : membership,
  );
  const hasRemainingActiveMember = memberships.some(
    (membership) =>
      membership.householdId === active.householdId && membership.endedAtMacroHourIndex === null,
  );
  const households = snapshot.households.households.map((household) =>
    household.householdId === active.householdId && !hasRemainingActiveMember
      ? Object.freeze({ ...household, dissolvedAtMacroHourIndex: input.endedAtMacroHourIndex })
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
