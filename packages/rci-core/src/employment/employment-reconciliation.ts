import { compareStableId } from '../contracts/ids.js';
import type { EmploymentAssignmentRecord } from '../contracts/records.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { ageBandAtTick } from '../population/age.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';
import {
  createEmploymentIndex,
  positionKey,
  type EmploymentProjection,
} from './employment-index.js';
import { workplaceCapacityProfileForId } from './workplace-capacity.js';

interface PositionCandidate {
  readonly workplaceId: string;
  readonly positionGroupDefinitionId: string;
  readonly capacity: number;
  readonly requiredRank: number;
}

export interface EmploymentReconciliationPlan {
  readonly baseRciRevision: number;
  readonly proposedSnapshot: RciSnapshot;
  readonly projection: EmploymentProjection;
  readonly startedAssignmentIds: readonly string[];
  readonly endedAssignmentIds: readonly string[];
  readonly upgradedCitizenIds: readonly string[];
  readonly valid: boolean;
  readonly invalidReason: string | null;
}

function positionCandidates(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
): readonly PositionCandidate[] {
  const values: PositionCandidate[] = [];
  for (const workplace of [...snapshot.employment.workplaces].sort((a, b) =>
    compareStableId(a.workplaceId, b.workplaceId),
  )) {
    if (workplace.retiredAtTick !== null) continue;
    const profile = workplaceCapacityProfileForId(
      registries.capacityProfiles,
      workplace.capacityProfileDefinitionId,
    );
    for (const group of profile.positionGroups) {
      const requirement = registries.employmentRequirements.get(
        group.employmentRequirementDefinitionId,
      );
      values.push(
        Object.freeze({
          workplaceId: workplace.workplaceId,
          positionGroupDefinitionId: group.positionGroupDefinitionId,
          capacity: group.capacity,
          requiredRank: registries.qualifications.get(requirement.minimumQualificationDefinitionId)
            .rank,
        }),
      );
    }
  }
  return Object.freeze(
    values.sort(
      (a, b) =>
        a.requiredRank - b.requiredRank ||
        compareStableId(a.workplaceId, b.workplaceId) ||
        compareStableId(a.positionGroupDefinitionId, b.positionGroupDefinitionId),
    ),
  );
}

function activeQualificationRank(
  snapshot: RciSnapshot,
  citizenId: string,
  registries: RciDefinitionRegistries,
): number | null {
  const qualification = snapshot.population.qualifications.find(
    (value) => value.citizenId === citizenId && value.endedAtTick === null,
  );
  return qualification === undefined
    ? null
    : registries.qualifications.get(qualification.qualificationDefinitionId).rank;
}

function eligibleCitizen(
  snapshot: RciSnapshot,
  citizenId: string,
  evaluationTick: number,
): boolean {
  const citizen = snapshot.population.citizens.find((value) => value.citizenId === citizenId);
  return (
    citizen !== undefined &&
    citizen.presence === 'resident' &&
    ageBandAtTick(citizen.bornAtTick, evaluationTick) === 'age-band.working-age'
  );
}

export function planEmploymentReconciliation(
  input: Readonly<{
    snapshot: RciSnapshot;
    evaluationTick: number;
    registries: RciDefinitionRegistries;
    allowControlledUpgrade?: boolean;
  }>,
): EmploymentReconciliationPlan {
  let assignments = [...input.snapshot.employment.assignments];
  const candidates = positionCandidates(input.snapshot, input.registries);
  const candidateByKey = new Map(
    candidates.map((candidate) => [
      positionKey(candidate.workplaceId, candidate.positionGroupDefinitionId),
      candidate,
    ]),
  );
  const usedByKey = new Map<string, number>();
  const endedAssignmentIds: string[] = [];

  assignments = assignments.map((assignment) => {
    if (assignment.endedAtTick !== null) return assignment;
    const candidate = candidateByKey.get(
      positionKey(assignment.workplaceId, assignment.positionGroupDefinitionId),
    );
    const qualificationRank = activeQualificationRank(
      input.snapshot,
      assignment.citizenId,
      input.registries,
    );
    const key = positionKey(assignment.workplaceId, assignment.positionGroupDefinitionId);
    const used = usedByKey.get(key) ?? 0;
    const valid =
      candidate !== undefined &&
      eligibleCitizen(input.snapshot, assignment.citizenId, input.evaluationTick) &&
      qualificationRank !== null &&
      qualificationRank >= candidate.requiredRank &&
      used < candidate.capacity;
    if (valid) {
      usedByKey.set(key, used + 1);
      return assignment;
    }
    endedAssignmentIds.push(assignment.employmentAssignmentId);
    return Object.freeze({
      ...assignment,
      endedAtTick: input.evaluationTick,
      endReasonDefinitionId: 'employment-ended.no-longer-eligible',
    });
  });

  const activeCitizenIds = new Set(
    assignments
      .filter((assignment) => assignment.endedAtTick === null)
      .map((assignment) => assignment.citizenId),
  );
  const unemployed = input.snapshot.population.citizens
    .filter(
      (citizen) =>
        eligibleCitizen(input.snapshot, citizen.citizenId, input.evaluationTick) &&
        !activeCitizenIds.has(citizen.citizenId),
    )
    .sort((a, b) => compareStableId(a.citizenId, b.citizenId));
  const startedAssignmentIds: string[] = [];
  const upgradedCitizenIds: string[] = [];
  let nextAssignment = input.snapshot.sequences.nextEmploymentAssignment;

  for (const citizen of unemployed) {
    const rank = activeQualificationRank(input.snapshot, citizen.citizenId, input.registries);
    if (rank === null) continue;
    const candidate = candidates
      .filter((position) => {
        const used =
          usedByKey.get(positionKey(position.workplaceId, position.positionGroupDefinitionId)) ?? 0;
        return used < position.capacity && rank >= position.requiredRank;
      })
      .sort(
        (a, b) =>
          rank - a.requiredRank - (rank - b.requiredRank) ||
          compareStableId(a.workplaceId, b.workplaceId) ||
          compareStableId(a.positionGroupDefinitionId, b.positionGroupDefinitionId),
      )[0];
    if (candidate === undefined) continue;
    const assignment: EmploymentAssignmentRecord = Object.freeze({
      employmentAssignmentId: `employment-assignment:${nextAssignment}`,
      citizenId: citizen.citizenId,
      workplaceId: candidate.workplaceId,
      positionGroupDefinitionId: candidate.positionGroupDefinitionId,
      startedAtTick: input.evaluationTick,
      endedAtTick: null,
      endReasonDefinitionId: null,
    });
    assignments.push(assignment);
    startedAssignmentIds.push(assignment.employmentAssignmentId);
    const key = positionKey(candidate.workplaceId, candidate.positionGroupDefinitionId);
    usedByKey.set(key, (usedByKey.get(key) ?? 0) + 1);
    activeCitizenIds.add(citizen.citizenId);
    nextAssignment += 1;
  }

  if (input.allowControlledUpgrade ?? true) {
    const activeAssignments = assignments
      .filter((assignment) => assignment.endedAtTick === null)
      .sort((a, b) => compareStableId(a.citizenId, b.citizenId));
    for (const assignment of activeAssignments) {
      const rank = activeQualificationRank(input.snapshot, assignment.citizenId, input.registries);
      const current = candidateByKey.get(
        positionKey(assignment.workplaceId, assignment.positionGroupDefinitionId),
      );
      if (rank === null || current === undefined) continue;
      const currentDistance = rank - current.requiredRank;
      const better = candidates
        .filter((candidate) => {
          const used =
            usedByKey.get(
              positionKey(candidate.workplaceId, candidate.positionGroupDefinitionId),
            ) ?? 0;
          return (
            used < candidate.capacity &&
            rank >= candidate.requiredRank &&
            rank - candidate.requiredRank < currentDistance
          );
        })
        .sort(
          (a, b) =>
            rank - a.requiredRank - (rank - b.requiredRank) ||
            compareStableId(a.workplaceId, b.workplaceId) ||
            compareStableId(a.positionGroupDefinitionId, b.positionGroupDefinitionId),
        )[0];
      if (better === undefined) continue;
      const oldKey = positionKey(assignment.workplaceId, assignment.positionGroupDefinitionId);
      const newKey = positionKey(better.workplaceId, better.positionGroupDefinitionId);
      assignments = assignments.map((value) =>
        value.employmentAssignmentId === assignment.employmentAssignmentId
          ? Object.freeze({
              ...value,
              endedAtTick: input.evaluationTick,
              endReasonDefinitionId: 'employment-ended.best-fit-upgrade',
            })
          : value,
      );
      endedAssignmentIds.push(assignment.employmentAssignmentId);
      const replacement: EmploymentAssignmentRecord = Object.freeze({
        employmentAssignmentId: `employment-assignment:${nextAssignment}`,
        citizenId: assignment.citizenId,
        workplaceId: better.workplaceId,
        positionGroupDefinitionId: better.positionGroupDefinitionId,
        startedAtTick: input.evaluationTick,
        endedAtTick: null,
        endReasonDefinitionId: null,
      });
      assignments.push(replacement);
      startedAssignmentIds.push(replacement.employmentAssignmentId);
      upgradedCitizenIds.push(assignment.citizenId);
      usedByKey.set(oldKey, Math.max(0, (usedByKey.get(oldKey) ?? 1) - 1));
      usedByKey.set(newKey, (usedByKey.get(newKey) ?? 0) + 1);
      nextAssignment += 1;
      break;
    }
  }

  const changed = startedAssignmentIds.length > 0 || endedAssignmentIds.length > 0;
  const proposedSnapshot = changed
    ? canonicalizeRciSnapshot({
        ...input.snapshot,
        revision: input.snapshot.revision + 1,
        employment: {
          ...input.snapshot.employment,
          revision: input.snapshot.employment.revision + 1,
          assignments,
        },
        sequences: {
          ...input.snapshot.sequences,
          nextEmploymentAssignment: nextAssignment,
        },
      })
    : input.snapshot;
  return Object.freeze({
    baseRciRevision: input.snapshot.revision,
    proposedSnapshot,
    projection: createEmploymentIndex(proposedSnapshot, input.registries, input.evaluationTick)
      .projection,
    startedAssignmentIds: Object.freeze(startedAssignmentIds.sort(compareStableId)),
    endedAssignmentIds: Object.freeze(endedAssignmentIds.sort(compareStableId)),
    upgradedCitizenIds: Object.freeze(upgradedCitizenIds.sort(compareStableId)),
    valid: true,
    invalidReason: null,
  });
}
