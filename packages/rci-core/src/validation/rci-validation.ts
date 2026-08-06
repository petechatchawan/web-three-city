import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import type { RciContractErrorCode } from '../contracts/errors.js';
import { compareStableId } from '../contracts/ids.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import type { RciSequenceState, RciSnapshot } from '../rci-snapshot.js';

export interface RciValidationIssue {
  readonly code: RciContractErrorCode;
  readonly entityId?: string;
  readonly referenceId?: string;
}

export interface RciValidationResult {
  readonly valid: boolean;
  readonly issues: readonly RciValidationIssue[];
}

function nonNegativeSafe(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function addIssue(
  issues: RciValidationIssue[],
  code: RciContractErrorCode,
  entityId?: string,
  referenceId?: string,
): void {
  const issue: RciValidationIssue = {
    code,
    ...(entityId === undefined ? {} : { entityId }),
    ...(referenceId === undefined ? {} : { referenceId }),
  };
  issues.push(Object.freeze(issue));
}

function checkUnique(
  values: readonly string[],
  issues: RciValidationIssue[],
  code: RciContractErrorCode = 'rci:invalid-state',
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (value.length === 0 || seen.has(value)) addIssue(issues, code, value);
    seen.add(value);
  }
}

function generatedNumber(id: string, prefix: string): number | null {
  if (!id.startsWith(prefix)) return null;
  const suffix = id.slice(prefix.length);
  if (!/^[1-9][0-9]*$/.test(suffix)) return null;
  const value = Number(suffix);
  return Number.isSafeInteger(value) ? value : null;
}

function checkSequence(
  sequence: number,
  ids: readonly string[],
  prefix: string,
  issues: RciValidationIssue[],
): void {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    addIssue(issues, 'rci:invalid-state');
    return;
  }
  let maximum = 0;
  for (const id of ids) maximum = Math.max(maximum, generatedNumber(id, prefix) ?? 0);
  if (sequence <= maximum) addIssue(issues, 'rci:invalid-state');
}

function validateSequences(snapshot: RciSnapshot, issues: RciValidationIssue[]): void {
  const sequences: RciSequenceState = snapshot.sequences;
  checkSequence(
    sequences.nextCitizen,
    snapshot.population.citizens.map((value) => value.citizenId),
    'citizen:',
    issues,
  );
  checkSequence(
    sequences.nextHousehold,
    snapshot.households.households.map((value) => value.householdId),
    'household:',
    issues,
  );
  checkSequence(
    sequences.nextHouseholdMembership,
    snapshot.households.memberships.map((value) => value.membershipId),
    'household-membership:',
    issues,
  );
  checkSequence(
    sequences.nextRelationship,
    snapshot.relationships.relationships.map((value) => value.relationshipId),
    'relationship:',
    issues,
  );
  checkSequence(
    sequences.nextCitizenQualification,
    snapshot.population.qualifications.map((value) => value.citizenQualificationId),
    'citizen-qualification:',
    issues,
  );
  checkSequence(
    sequences.nextHousingAssignment,
    snapshot.housing.assignments.map((value) => value.housingAssignmentId),
    'housing-assignment:',
    issues,
  );
  checkSequence(
    sequences.nextEmploymentAssignment,
    snapshot.employment.assignments.map((value) => value.employmentAssignmentId),
    'employment-assignment:',
    issues,
  );
  checkSequence(
    sequences.nextIncomingRequest,
    snapshot.migration.incomingRequests.map((value) => value.requestId),
    'incoming-household:',
    issues,
  );
  if (!Number.isSafeInteger(sequences.nextDomainEvent) || sequences.nextDomainEvent < 1) {
    addIssue(issues, 'rci:invalid-state');
  }
}

export function validateRciSnapshot(
  snapshot: RciSnapshot,
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
  registries: RciDefinitionRegistries,
): RciValidationResult {
  const issues: RciValidationIssue[] = [];
  const revisions = [
    snapshot.revision,
    snapshot.population.revision,
    snapshot.relationships.revision,
    snapshot.households.revision,
    snapshot.housing.revision,
    snapshot.employment.revision,
    snapshot.migration.revision,
    snapshot.demand.revision,
  ];
  if (
    revisions.some((revision) => !nonNegativeSafe(revision)) ||
    !nonNegativeSafe(snapshot.deterministicSeed) ||
    !nonNegativeSafe(simulation.revision) ||
    !nonNegativeSafe(simulation.absoluteTick) ||
    !nonNegativeSafe(buildings.revision)
  ) {
    addIssue(issues, 'rci:invalid-state');
  }

  checkUnique(
    snapshot.population.citizens.map((value) => value.citizenId),
    issues,
  );
  checkUnique(
    snapshot.population.qualifications.map((value) => value.citizenQualificationId),
    issues,
  );
  checkUnique(
    snapshot.relationships.relationships.map((value) => value.relationshipId),
    issues,
  );
  checkUnique(
    snapshot.households.households.map((value) => value.householdId),
    issues,
  );
  checkUnique(
    snapshot.households.memberships.map((value) => value.membershipId),
    issues,
  );
  checkUnique(snapshot.housing.dwellingUnits.map((value) => value.dwellingUnitId), issues);
  checkUnique(
    snapshot.housing.assignments.map((value) => value.housingAssignmentId),
    issues,
  );
  checkUnique(snapshot.employment.workplaces.map((value) => value.workplaceId), issues);
  checkUnique(
    snapshot.employment.assignments.map((value) => value.employmentAssignmentId),
    issues,
  );
  checkUnique(snapshot.migration.incomingRequests.map((value) => value.requestId), issues);

  const citizens = new Map(snapshot.population.citizens.map((value) => [value.citizenId, value]));
  const households = new Map(
    snapshot.households.households.map((value) => [value.householdId, value]),
  );
  const dwellingUnits = new Map(
    snapshot.housing.dwellingUnits.map((value) => [value.dwellingUnitId, value]),
  );
  const workplaces = new Map(
    snapshot.employment.workplaces.map((value) => [value.workplaceId, value]),
  );
  const buildingIds = new Set(buildings.instances.map((value) => value.instanceId));
  const activeMembershipCount = new Map<string, number>();

  for (const citizen of snapshot.population.citizens) {
    if (
      !Number.isSafeInteger(citizen.bornAtTick) ||
      citizen.bornAtTick > simulation.absoluteTick ||
      !nonNegativeSafe(citizen.movedIntoCityAtTick) ||
      citizen.movedIntoCityAtTick > simulation.absoluteTick ||
      (citizen.movedOutOfCityAtTick !== null &&
        (!nonNegativeSafe(citizen.movedOutOfCityAtTick) ||
          citizen.movedOutOfCityAtTick < citizen.movedIntoCityAtTick ||
          citizen.movedOutOfCityAtTick > simulation.absoluteTick)) ||
      (citizen.diedAtTick !== null &&
        (!nonNegativeSafe(citizen.diedAtTick) ||
          citizen.diedAtTick < citizen.bornAtTick ||
          citizen.diedAtTick > simulation.absoluteTick))
    ) {
      addIssue(issues, 'rci:invalid-state', citizen.citizenId);
    }
    if (!registries.sexes.has(citizen.sexDefinitionId)) {
      addIssue(issues, 'rci:unknown-definition', citizen.citizenId, citizen.sexDefinitionId);
    }
    if (
      (citizen.presence === 'resident' &&
        (citizen.movedOutOfCityAtTick !== null || citizen.diedAtTick !== null)) ||
      (citizen.presence === 'emigrated' &&
        (citizen.movedOutOfCityAtTick === null || citizen.diedAtTick !== null)) ||
      (citizen.presence === 'deceased' && citizen.diedAtTick === null)
    ) {
      addIssue(issues, 'rci:invalid-state', citizen.citizenId);
    }
  }

  for (const membership of snapshot.households.memberships) {
    if (!citizens.has(membership.citizenId)) {
      addIssue(issues, 'rci:dangling-citizen', membership.membershipId, membership.citizenId);
    }
    if (!households.has(membership.householdId)) {
      addIssue(
        issues,
        'rci:dangling-household',
        membership.membershipId,
        membership.householdId,
      );
    }
    if (membership.endedAtTick === null) {
      activeMembershipCount.set(
        membership.citizenId,
        (activeMembershipCount.get(membership.citizenId) ?? 0) + 1,
      );
    }
  }
  for (const citizen of snapshot.population.citizens) {
    const count = activeMembershipCount.get(citizen.citizenId) ?? 0;
    if (count > 1) addIssue(issues, 'rci:duplicate-active-membership', citizen.citizenId);
    if ((citizen.presence === 'resident' && count !== 1) || (citizen.presence !== 'resident' && count !== 0)) {
      addIssue(issues, 'rci:invalid-state', citizen.citizenId);
    }
  }

  const activePartnerByCitizen = new Set<string>();
  for (const relationship of snapshot.relationships.relationships) {
    if (!registries.relationshipTypes.has(relationship.typeDefinitionId)) {
      addIssue(
        issues,
        'rci:unknown-definition',
        relationship.relationshipId,
        relationship.typeDefinitionId,
      );
    }
    const participants =
      relationship.orientation === 'directional'
        ? [relationship.sourceCitizenId, relationship.targetCitizenId]
        : relationship.participantCitizenIds;
    if (participants[0] === participants[1]) {
      addIssue(issues, 'rci:invalid-relationship', relationship.relationshipId);
    }
    for (const participant of participants) {
      if (!citizens.has(participant)) {
        addIssue(issues, 'rci:dangling-citizen', relationship.relationshipId, participant);
      }
    }
    if (
      relationship.orientation === 'undirected' &&
      compareStableId(relationship.participantCitizenIds[0], relationship.participantCitizenIds[1]) >=
        0
    ) {
      addIssue(issues, 'rci:invalid-relationship', relationship.relationshipId);
    }
    if (
      relationship.orientation === 'undirected' &&
      relationship.typeDefinitionId === 'relationship.partner' &&
      relationship.endedAtTick === null
    ) {
      for (const participant of relationship.participantCitizenIds) {
        if (activePartnerByCitizen.has(participant)) {
          addIssue(issues, 'rci:duplicate-active-partner', participant);
        }
        activePartnerByCitizen.add(participant);
      }
    }
  }

  for (const qualification of snapshot.population.qualifications) {
    if (!citizens.has(qualification.citizenId)) {
      addIssue(
        issues,
        'rci:dangling-citizen',
        qualification.citizenQualificationId,
        qualification.citizenId,
      );
    }
    if (!registries.qualifications.has(qualification.qualificationDefinitionId)) {
      addIssue(
        issues,
        'rci:unknown-definition',
        qualification.citizenQualificationId,
        qualification.qualificationDefinitionId,
      );
    }
  }

  for (const unit of snapshot.housing.dwellingUnits) {
    if (!buildingIds.has(unit.buildingInstanceId)) {
      addIssue(issues, 'rci:dangling-building', unit.dwellingUnitId, unit.buildingInstanceId);
    }
    if (!registries.capacityProfiles.has(unit.capacityProfileDefinitionId)) {
      addIssue(
        issues,
        'rci:unknown-definition',
        unit.dwellingUnitId,
        unit.capacityProfileDefinitionId,
      );
    }
  }
  const activeHousingByHousehold = new Set<string>();
  const activeHousingByUnit = new Set<string>();
  for (const assignment of snapshot.housing.assignments) {
    if (!households.has(assignment.householdId)) {
      addIssue(
        issues,
        'rci:dangling-household',
        assignment.housingAssignmentId,
        assignment.householdId,
      );
    }
    if (!dwellingUnits.has(assignment.dwellingUnitId)) {
      addIssue(issues, 'rci:invalid-state', assignment.housingAssignmentId, assignment.dwellingUnitId);
    }
    if (assignment.endedAtTick === null) {
      if (
        activeHousingByHousehold.has(assignment.householdId) ||
        activeHousingByUnit.has(assignment.dwellingUnitId)
      ) {
        addIssue(issues, 'rci:duplicate-active-housing', assignment.housingAssignmentId);
      }
      activeHousingByHousehold.add(assignment.householdId);
      activeHousingByUnit.add(assignment.dwellingUnitId);
    }
  }

  for (const workplace of snapshot.employment.workplaces) {
    if (!buildingIds.has(workplace.buildingInstanceId)) {
      addIssue(issues, 'rci:dangling-building', workplace.workplaceId, workplace.buildingInstanceId);
    }
    if (!registries.capacityProfiles.has(workplace.capacityProfileDefinitionId)) {
      addIssue(
        issues,
        'rci:unknown-definition',
        workplace.workplaceId,
        workplace.capacityProfileDefinitionId,
      );
    }
  }
  const activeEmploymentByCitizen = new Set<string>();
  for (const assignment of snapshot.employment.assignments) {
    if (!citizens.has(assignment.citizenId)) {
      addIssue(
        issues,
        'rci:dangling-citizen',
        assignment.employmentAssignmentId,
        assignment.citizenId,
      );
    }
    if (!workplaces.has(assignment.workplaceId)) {
      addIssue(
        issues,
        'rci:invalid-state',
        assignment.employmentAssignmentId,
        assignment.workplaceId,
      );
    }
    if (!registries.positionGroups.has(assignment.positionGroupDefinitionId)) {
      addIssue(
        issues,
        'rci:unknown-definition',
        assignment.employmentAssignmentId,
        assignment.positionGroupDefinitionId,
      );
    }
    if (assignment.endedAtTick === null) {
      if (activeEmploymentByCitizen.has(assignment.citizenId)) {
        addIssue(issues, 'rci:duplicate-active-employment', assignment.citizenId);
      }
      activeEmploymentByCitizen.add(assignment.citizenId);
    }
  }

  for (const entry of snapshot.migration.displacedHouseholds) {
    if (!households.has(entry.householdId)) {
      addIssue(issues, 'rci:dangling-household', entry.householdId);
    }
  }
  if (
    !Number.isSafeInteger(snapshot.migration.attractionMilli) ||
    snapshot.migration.attractionMilli < 0
  ) {
    addIssue(issues, 'rci:invalid-queue');
  }
  const demandValues = [
    snapshot.demand.demand.residentialMilli,
    snapshot.demand.demand.commercialMilli,
    snapshot.demand.demand.industrialMilli,
  ];
  if (
    demandValues.some(
      (value) => !Number.isSafeInteger(value) || value < -100_000 || value > 100_000,
    ) ||
    !nonNegativeSafe(snapshot.demand.demand.evaluatedAtTick) ||
    snapshot.demand.demand.evaluatedAtTick > simulation.absoluteTick ||
    !nonNegativeSafe(snapshot.demand.growthGates.evaluatedAtTick) ||
    snapshot.demand.growthGates.evaluatedAtTick > simulation.absoluteTick
  ) {
    addIssue(issues, 'rci:invalid-demand');
  }

  validateSequences(snapshot, issues);

  const unique = new Map<string, RciValidationIssue>();
  for (const issue of issues) {
    unique.set(`${issue.code}|${issue.entityId ?? ''}|${issue.referenceId ?? ''}`, issue);
  }
  const sorted = Object.freeze(
    [...unique.values()].sort(
      (first, second) =>
        compareStableId(first.code, second.code) ||
        compareStableId(first.entityId ?? '', second.entityId ?? '') ||
        compareStableId(first.referenceId ?? '', second.referenceId ?? ''),
    ),
  );
  return Object.freeze({ valid: sorted.length === 0, issues: sorted });
}
