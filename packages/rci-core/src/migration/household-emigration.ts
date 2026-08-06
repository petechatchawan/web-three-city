import { RciContractError } from '../contracts/errors.js';
import type { HouseholdId } from '../contracts/ids.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function planEmigrateHousehold(input: Readonly<{
  snapshot: RciSnapshot;
  householdId: HouseholdId;
  evaluationTick: number;
  endReasonDefinitionId: string;
}>): RciSnapshot {
  const memberIds = new Set(
    input.snapshot.households.memberships
      .filter(
        (membership) =>
          membership.householdId === input.householdId && membership.endedAtTick === null,
      )
      .map((membership) => membership.citizenId),
  );
  if (memberIds.size === 0) throw new RciContractError('rci:dangling-household');
  const activeHousingIds = new Set(
    input.snapshot.housing.assignments
      .filter(
        (assignment) =>
          assignment.householdId === input.householdId && assignment.endedAtTick === null,
      )
      .map((assignment) => assignment.housingAssignmentId),
  );
  const activeEmploymentIds = new Set(
    input.snapshot.employment.assignments
      .filter(
        (assignment) =>
          memberIds.has(assignment.citizenId) && assignment.endedAtTick === null,
      )
      .map((assignment) => assignment.employmentAssignmentId),
  );
  return canonicalizeRciSnapshot({
    ...input.snapshot,
    revision: input.snapshot.revision + 1,
    population: {
      revision: input.snapshot.population.revision + 1,
      citizens: input.snapshot.population.citizens.map((citizen) =>
        memberIds.has(citizen.citizenId) && citizen.presence === 'resident'
          ? Object.freeze({
              ...citizen,
              presence: 'emigrated' as const,
              movedOutOfCityAtTick: input.evaluationTick,
            })
          : citizen,
      ),
      qualifications: input.snapshot.population.qualifications.map((qualification) =>
        memberIds.has(qualification.citizenId) && qualification.endedAtTick === null
          ? Object.freeze({ ...qualification, endedAtTick: input.evaluationTick })
          : qualification,
      ),
    },
    households: {
      revision: input.snapshot.households.revision + 1,
      households: input.snapshot.households.households.map((household) =>
        household.householdId === input.householdId && household.dissolvedAtTick === null
          ? Object.freeze({ ...household, dissolvedAtTick: input.evaluationTick })
          : household,
      ),
      memberships: input.snapshot.households.memberships.map((membership) =>
        membership.householdId === input.householdId && membership.endedAtTick === null
          ? Object.freeze({
              ...membership,
              endedAtTick: input.evaluationTick,
              endReasonDefinitionId: input.endReasonDefinitionId,
            })
          : membership,
      ),
    },
    relationships: {
      revision: input.snapshot.relationships.revision + 1,
      relationships: input.snapshot.relationships.relationships.map((relationship) => {
        if (relationship.endedAtTick !== null || relationship.orientation !== 'undirected') {
          return relationship;
        }
        const members = relationship.participantCitizenIds.filter((citizenId) =>
          memberIds.has(citizenId),
        );
        return members.length === 1
          ? Object.freeze({ ...relationship, endedAtTick: input.evaluationTick })
          : relationship;
      }),
    },
    housing: {
      ...input.snapshot.housing,
      revision:
        activeHousingIds.size === 0
          ? input.snapshot.housing.revision
          : input.snapshot.housing.revision + 1,
      assignments: input.snapshot.housing.assignments.map((assignment) =>
        activeHousingIds.has(assignment.housingAssignmentId)
          ? Object.freeze({
              ...assignment,
              endedAtTick: input.evaluationTick,
              endReasonDefinitionId: 'housing-ended.household-emigrated',
            })
          : assignment,
      ),
    },
    employment: {
      ...input.snapshot.employment,
      revision:
        activeEmploymentIds.size === 0
          ? input.snapshot.employment.revision
          : input.snapshot.employment.revision + 1,
      assignments: input.snapshot.employment.assignments.map((assignment) =>
        activeEmploymentIds.has(assignment.employmentAssignmentId)
          ? Object.freeze({
              ...assignment,
              endedAtTick: input.evaluationTick,
              endReasonDefinitionId: 'employment-ended.citizen-emigrated',
            })
          : assignment,
      ),
    },
    migration: {
      ...input.snapshot.migration,
      revision: input.snapshot.migration.revision + 1,
      displacedHouseholds: input.snapshot.migration.displacedHouseholds.filter(
        (entry) => entry.householdId !== input.householdId,
      ),
    },
  });
}
