import { ageBandAtTick } from '../population/age.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import type { RciSnapshot } from '../rci-snapshot.js';
import { workplaceCapacityProfileForId } from './workplace-capacity.js';

export interface EmploymentProjection {
  readonly workingAgeResidentCount: number;
  readonly employedResidentCount: number;
  readonly unemployedResidentCount: number;
  readonly totalPositionCapacity: number;
  readonly occupiedPositionCount: number;
  readonly vacantPositionCount: number;
  readonly compatibleVacantPositionCount: number;
  readonly underemployedResidentCount: number;
}

export interface EmploymentIndex {
  readonly activeAssignmentByCitizenId: ReadonlyMap<string, string>;
  readonly occupiedCountByPositionKey: ReadonlyMap<string, number>;
  readonly activeQualificationByCitizenId: ReadonlyMap<string, string>;
  readonly projection: EmploymentProjection;
}

export function positionKey(workplaceId: string, positionGroupDefinitionId: string): string {
  return `${workplaceId}|${positionGroupDefinitionId}`;
}

export function createEmploymentIndex(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
  evaluationTick: number,
): EmploymentIndex {
  const activeQualificationByCitizenId = new Map<string, string>();
  for (const qualification of snapshot.population.qualifications) {
    if (qualification.endedAtTick === null) {
      activeQualificationByCitizenId.set(
        qualification.citizenId,
        qualification.qualificationDefinitionId,
      );
    }
  }
  const activeAssignmentByCitizenId = new Map<string, string>();
  const occupiedCountByPositionKey = new Map<string, number>();
  for (const assignment of snapshot.employment.assignments) {
    if (assignment.endedAtTick !== null) continue;
    activeAssignmentByCitizenId.set(assignment.citizenId, assignment.employmentAssignmentId);
    const key = positionKey(assignment.workplaceId, assignment.positionGroupDefinitionId);
    occupiedCountByPositionKey.set(key, (occupiedCountByPositionKey.get(key) ?? 0) + 1);
  }

  const workingAgeResidents = snapshot.population.citizens.filter(
    (citizen) =>
      citizen.presence === 'resident' &&
      ageBandAtTick(citizen.bornAtTick, evaluationTick) === 'age-band.working-age',
  );
  let totalPositionCapacity = 0;
  let compatibleVacantPositionCount = 0;
  let underemployedResidentCount = 0;
  for (const workplace of snapshot.employment.workplaces) {
    if (workplace.retiredAtTick !== null) continue;
    const profile = workplaceCapacityProfileForId(
      registries.capacityProfiles,
      workplace.capacityProfileDefinitionId,
    );
    for (const group of profile.positionGroups) {
      totalPositionCapacity += group.capacity;
      const occupied =
        occupiedCountByPositionKey.get(
          positionKey(workplace.workplaceId, group.positionGroupDefinitionId),
        ) ?? 0;
      const vacant = Math.max(0, group.capacity - occupied);
      if (vacant === 0) continue;
      const requirement = registries.employmentRequirements.get(
        group.employmentRequirementDefinitionId,
      );
      const requiredRank = registries.qualifications.get(
        requirement.minimumQualificationDefinitionId,
      ).rank;
      if (
        workingAgeResidents.some((citizen) => {
          if (activeAssignmentByCitizenId.has(citizen.citizenId)) return false;
          const qualificationId = activeQualificationByCitizenId.get(citizen.citizenId);
          return (
            qualificationId !== undefined &&
            registries.qualifications.get(qualificationId).rank >= requiredRank
          );
        })
      ) {
        compatibleVacantPositionCount += vacant;
      }
    }
  }

  const assignmentById = new Map(
    snapshot.employment.assignments.map((assignment) => [
      assignment.employmentAssignmentId,
      assignment,
    ]),
  );
  const workplaceById = new Map(
    snapshot.employment.workplaces.map((workplace) => [workplace.workplaceId, workplace]),
  );
  for (const citizen of workingAgeResidents) {
    const assignmentId = activeAssignmentByCitizenId.get(citizen.citizenId);
    const qualificationId = activeQualificationByCitizenId.get(citizen.citizenId);
    if (assignmentId === undefined || qualificationId === undefined) continue;
    const assignment = assignmentById.get(assignmentId);
    const workplace =
      assignment === undefined ? undefined : workplaceById.get(assignment.workplaceId);
    if (assignment === undefined || workplace === undefined) continue;
    const profile = workplaceCapacityProfileForId(
      registries.capacityProfiles,
      workplace.capacityProfileDefinitionId,
    );
    const group = profile.positionGroups.find(
      (value) => value.positionGroupDefinitionId === assignment.positionGroupDefinitionId,
    );
    if (group === undefined) continue;
    const requirement = registries.employmentRequirements.get(
      group.employmentRequirementDefinitionId,
    );
    const citizenRank = registries.qualifications.get(qualificationId).rank;
    const requiredRank = registries.qualifications.get(
      requirement.minimumQualificationDefinitionId,
    ).rank;
    if (citizenRank > requiredRank) underemployedResidentCount += 1;
  }

  const employedResidentCount = workingAgeResidents.filter((citizen) =>
    activeAssignmentByCitizenId.has(citizen.citizenId),
  ).length;
  const occupiedPositionCount = [...occupiedCountByPositionKey.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  return Object.freeze({
    activeAssignmentByCitizenId,
    occupiedCountByPositionKey,
    activeQualificationByCitizenId,
    projection: Object.freeze({
      workingAgeResidentCount: workingAgeResidents.length,
      employedResidentCount,
      unemployedResidentCount: workingAgeResidents.length - employedResidentCount,
      totalPositionCapacity,
      occupiedPositionCount,
      vacantPositionCount: Math.max(0, totalPositionCapacity - occupiedPositionCount),
      compatibleVacantPositionCount,
      underemployedResidentCount,
    }),
  });
}
