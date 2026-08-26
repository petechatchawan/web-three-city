import { RciContractError } from '../contracts/errors.js';
import type { MacroHourIndex } from '@web-three-city/simulation-core';
import type { DwellingUnitId, HouseholdId } from '../contracts/ids.js';
import type { HousingAssignmentRecord } from '../contracts/records.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function planStartHousingAssignment(
  input: Readonly<{
    snapshot: RciSnapshot;
    householdId: HouseholdId;
    dwellingUnitId: DwellingUnitId;
    startedAtMacroHourIndex: MacroHourIndex;
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
    household.dissolvedAtMacroHourIndex !== null ||
    unit === undefined ||
    unit.retiredAtMacroHourIndex !== null
  ) {
    throw new RciContractError('rci:invalid-state');
  }
  if (
    input.snapshot.housing.assignments.some(
      (assignment) =>
        assignment.endedAtMacroHourIndex === null &&
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
    startedAtMacroHourIndex: input.startedAtMacroHourIndex,
    endedAtMacroHourIndex: null,
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
  endedAtMacroHourIndex: MacroHourIndex,
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
        assignmentIds.has(assignment.housingAssignmentId) &&
        assignment.endedAtMacroHourIndex === null
          ? Object.freeze({ ...assignment, endedAtMacroHourIndex, endReasonDefinitionId })
          : assignment,
      ),
    },
  });
}
