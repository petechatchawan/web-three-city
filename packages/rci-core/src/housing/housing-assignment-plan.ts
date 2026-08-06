import { RciContractError } from '../contracts/errors.js';
import type { DwellingUnitId, HouseholdId } from '../contracts/ids.js';
import type { HousingAssignmentRecord } from '../contracts/records.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function planStartHousingAssignment(
  input: Readonly<{
    snapshot: RciSnapshot;
    householdId: HouseholdId;
    dwellingUnitId: DwellingUnitId;
    startedAtTick: number;
  }>,
): RciSnapshot {
  const household = input.snapshot.households.households.find(
    (value) => value.householdId === input.householdId,
  );
  const unit = input.snapshot.housing.dwellingUnits.find(
    (value) => value.dwellingUnitId === input.dwellingUnitId,
  );
  if (
    household === undefined ||
    household.dissolvedAtTick !== null ||
    unit === undefined ||
    unit.retiredAtTick !== null
  ) {
    throw new RciContractError('rci:invalid-state');
  }
  if (
    input.snapshot.housing.assignments.some(
      (assignment) =>
        assignment.endedAtTick === null &&
        (assignment.householdId === input.householdId ||
          assignment.dwellingUnitId === input.dwellingUnitId),
    )
  ) {
    throw new RciContractError('rci:duplicate-active-housing');
  }
  const assignment: HousingAssignmentRecord = Object.freeze({
    housingAssignmentId: `housing-assignment:${input.snapshot.sequences.nextHousingAssignment}`,
    householdId: input.householdId,
    dwellingUnitId: input.dwellingUnitId,
    startedAtTick: input.startedAtTick,
    endedAtTick: null,
    endReasonDefinitionId: null,
  });
  return canonicalizeRciSnapshot({
    ...input.snapshot,
    revision: input.snapshot.revision + 1,
    housing: {
      ...input.snapshot.housing,
      revision: input.snapshot.housing.revision + 1,
      assignments: [...input.snapshot.housing.assignments, assignment],
    },
    sequences: {
      ...input.snapshot.sequences,
      nextHousingAssignment: input.snapshot.sequences.nextHousingAssignment + 1,
    },
  });
}

export function endHousingAssignments(
  snapshot: RciSnapshot,
  assignmentIds: ReadonlySet<string>,
  endedAtTick: number,
  endReasonDefinitionId: string,
): RciSnapshot {
  if (assignmentIds.size === 0) return snapshot;
  return canonicalizeRciSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    housing: {
      ...snapshot.housing,
      revision: snapshot.housing.revision + 1,
      assignments: snapshot.housing.assignments.map((assignment) =>
        assignmentIds.has(assignment.housingAssignmentId) && assignment.endedAtTick === null
          ? Object.freeze({ ...assignment, endedAtTick, endReasonDefinitionId })
          : assignment,
      ),
    },
  });
}
