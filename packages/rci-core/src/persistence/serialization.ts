import { err, ok, type Result } from '@web-three-city/world-core';
import {
  deriveMacroHourIndex,
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { RciContractError } from '../contracts/errors.js';
import type {
  CitizenQualificationRecord,
  CitizenRecord,
  DirectionalRelationshipRecord,
  DisplacedHouseholdEntry,
  DwellingUnitRecord,
  EmploymentAssignmentRecord,
  HouseholdMembershipRecord,
  HouseholdRecord,
  HousingAssignmentRecord,
  IncomingHouseholdRequest,
  RciDemandState,
  RciGrowthGateState,
  RelationshipRecord,
  UndirectedRelationshipRecord,
  WorkplaceRecord,
} from '../contracts/records.js';
import {
  canonicalizeRciSnapshot,
  createRciSnapshot,
  type RciSequenceState,
  type RciSnapshot,
  type RciValidationContext,
} from '../rci-snapshot.js';
import {
  encodeAgeOriginAsLegacyMacroHour,
  migrateLegacyAgeOrigin,
} from '../migration/legacy-age-origin-migration.js';

interface LegacyCitizenRecord {
  readonly citizenId: CitizenRecord['citizenId'];
  readonly presence: CitizenRecord['presence'];
  readonly sexDefinitionId: CitizenRecord['sexDefinitionId'];
  readonly bornAtTick: number;
  readonly movedIntoCityAtTick: number;
  readonly movedOutOfCityAtTick: number | null;
  readonly diedAtTick: number | null;
}

interface LegacyHouseholdRecord {
  readonly householdId: HouseholdRecord['householdId'];
  readonly foundedAtTick: number;
  readonly dissolvedAtTick: number | null;
}

interface LegacyHouseholdMembershipRecord {
  readonly membershipId: HouseholdMembershipRecord['membershipId'];
  readonly householdId: HouseholdMembershipRecord['householdId'];
  readonly citizenId: HouseholdMembershipRecord['citizenId'];
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

interface LegacyDirectionalRelationshipRecord {
  readonly relationshipId: DirectionalRelationshipRecord['relationshipId'];
  readonly orientation: 'directional';
  readonly typeDefinitionId: DirectionalRelationshipRecord['typeDefinitionId'];
  readonly sourceCitizenId: DirectionalRelationshipRecord['sourceCitizenId'];
  readonly targetCitizenId: DirectionalRelationshipRecord['targetCitizenId'];
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
}

interface LegacyUndirectedRelationshipRecord {
  readonly relationshipId: UndirectedRelationshipRecord['relationshipId'];
  readonly orientation: 'undirected';
  readonly typeDefinitionId: UndirectedRelationshipRecord['typeDefinitionId'];
  readonly participantCitizenIds: UndirectedRelationshipRecord['participantCitizenIds'];
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
}

type LegacyRelationshipRecord =
  LegacyDirectionalRelationshipRecord | LegacyUndirectedRelationshipRecord;

interface LegacyCitizenQualificationRecord {
  readonly citizenQualificationId: CitizenQualificationRecord['citizenQualificationId'];
  readonly citizenId: CitizenQualificationRecord['citizenId'];
  readonly qualificationDefinitionId: CitizenQualificationRecord['qualificationDefinitionId'];
  readonly awardedAtTick: number;
  readonly endedAtTick: number | null;
  readonly sourceDefinitionId: string;
}

interface LegacyDwellingUnitRecord {
  readonly dwellingUnitId: DwellingUnitRecord['dwellingUnitId'];
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: DwellingUnitRecord['capacityProfileDefinitionId'];
  readonly unitIndex: number;
  readonly activatedAtTick: number;
  readonly retiredAtTick: number | null;
}

interface LegacyHousingAssignmentRecord {
  readonly housingAssignmentId: HousingAssignmentRecord['housingAssignmentId'];
  readonly householdId: HousingAssignmentRecord['householdId'];
  readonly dwellingUnitId: HousingAssignmentRecord['dwellingUnitId'];
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

interface LegacyWorkplaceRecord {
  readonly workplaceId: WorkplaceRecord['workplaceId'];
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: WorkplaceRecord['capacityProfileDefinitionId'];
  readonly activatedAtTick: number;
  readonly retiredAtTick: number | null;
}

interface LegacyEmploymentAssignmentRecord {
  readonly employmentAssignmentId: EmploymentAssignmentRecord['employmentAssignmentId'];
  readonly citizenId: EmploymentAssignmentRecord['citizenId'];
  readonly workplaceId: EmploymentAssignmentRecord['workplaceId'];
  readonly positionGroupDefinitionId: EmploymentAssignmentRecord['positionGroupDefinitionId'];
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

interface LegacyIncomingHouseholdRequest {
  readonly requestId: IncomingHouseholdRequest['requestId'];
  readonly archetypeDefinitionId: IncomingHouseholdRequest['archetypeDefinitionId'];
  readonly requestedAtTick: number;
  readonly minimumResidentCapacity: number;
  readonly queuePriority: number;
  readonly deterministicSequence: number;
}

interface LegacyDisplacedHouseholdEntry {
  readonly householdId: DisplacedHouseholdEntry['householdId'];
  readonly displacedAtTick: number;
  readonly expiresAtTick: number;
  readonly minimumResidentCapacity: number;
  readonly displacementPressure: number;
  readonly deterministicSequence: number;
}

interface LegacyRciDemandState {
  readonly residentialMilli: number;
  readonly commercialMilli: number;
  readonly industrialMilli: number;
  readonly evaluatedAtTick: number;
}

interface LegacyRciGrowthGateState {
  readonly residentialOpen: boolean;
  readonly commercialOpen: boolean;
  readonly industrialOpen: boolean;
  readonly evaluatedAtTick: number;
}

export interface RciSaveV1 {
  readonly kind: 'rci-save';
  readonly schemaVersion: 1;
  readonly deterministicSeed: number;
  readonly rootRevision: number;
  readonly populationRevision: number;
  readonly relationshipRevision: number;
  readonly householdRevision: number;
  readonly housingRevision: number;
  readonly employmentRevision: number;
  readonly migrationRevision: number;
  readonly demandRevision: number;
  readonly population: Readonly<{
    citizens: readonly LegacyCitizenRecord[];
    qualifications: readonly LegacyCitizenQualificationRecord[];
  }>;
  readonly relationships: readonly LegacyRelationshipRecord[];
  readonly households: Readonly<{
    households: readonly LegacyHouseholdRecord[];
    memberships: readonly LegacyHouseholdMembershipRecord[];
  }>;
  readonly housing: Readonly<{
    dwellingUnits: readonly LegacyDwellingUnitRecord[];
    assignments: readonly LegacyHousingAssignmentRecord[];
  }>;
  readonly employment: Readonly<{
    workplaces: readonly LegacyWorkplaceRecord[];
    assignments: readonly LegacyEmploymentAssignmentRecord[];
  }>;
  readonly migration: Readonly<{
    incomingRequests: readonly LegacyIncomingHouseholdRequest[];
    displacedHouseholds: readonly LegacyDisplacedHouseholdEntry[];
    attractionMilli: number;
  }>;
  readonly demand: LegacyRciDemandState;
  readonly growthGates: LegacyRciGrowthGateState;
  readonly sequences: RciSequenceState;
}

export type RciSaveErrorCode =
  | 'rci-save:invalid-schema'
  | 'rci-save:invalid-state'
  | 'rci-save:unknown-definition'
  | 'rci-save:dangling-reference'
  | 'rci-save:invalid-sequence';

export interface RciSaveError {
  readonly code: RciSaveErrorCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeMacroHourIndex(value: number): MacroHourIndex {
  try {
    return macroHourIndex(value);
  } catch {
    throw new RciContractError('rci:invalid-state');
  }
}

function decodeNullableMacroHourIndex(value: number | null): MacroHourIndex | null {
  return value === null ? null : decodeMacroHourIndex(value);
}

function decodeCitizen(
  record: LegacyCitizenRecord,
  currentMacroHourIndex: MacroHourIndex,
): CitizenRecord {
  return {
    citizenId: record.citizenId,
    presence: record.presence,
    sexDefinitionId: record.sexDefinitionId,
    bornAtMacroHourIndex: migrateLegacyAgeOrigin({
      legacyBornAtMacroHour: record.bornAtTick,
      currentMacroHour: currentMacroHourIndex,
    }),
    movedIntoCityAtMacroHourIndex: decodeMacroHourIndex(record.movedIntoCityAtTick),
    movedOutOfCityAtMacroHourIndex: decodeNullableMacroHourIndex(record.movedOutOfCityAtTick),
    diedAtMacroHourIndex: decodeNullableMacroHourIndex(record.diedAtTick),
  };
}

function decodeQualification(record: LegacyCitizenQualificationRecord): CitizenQualificationRecord {
  return {
    citizenQualificationId: record.citizenQualificationId,
    citizenId: record.citizenId,
    qualificationDefinitionId: record.qualificationDefinitionId,
    awardedAtMacroHourIndex: decodeMacroHourIndex(record.awardedAtTick),
    endedAtMacroHourIndex: decodeNullableMacroHourIndex(record.endedAtTick),
    sourceDefinitionId: record.sourceDefinitionId,
  };
}

function decodeRelationship(record: LegacyRelationshipRecord): RelationshipRecord {
  return record.orientation === 'directional'
    ? {
        relationshipId: record.relationshipId,
        orientation: record.orientation,
        typeDefinitionId: record.typeDefinitionId,
        sourceCitizenId: record.sourceCitizenId,
        targetCitizenId: record.targetCitizenId,
        startedAtMacroHourIndex: decodeMacroHourIndex(record.startedAtTick),
        endedAtMacroHourIndex: decodeNullableMacroHourIndex(record.endedAtTick),
      }
    : {
        relationshipId: record.relationshipId,
        orientation: record.orientation,
        typeDefinitionId: record.typeDefinitionId,
        participantCitizenIds: record.participantCitizenIds,
        startedAtMacroHourIndex: decodeMacroHourIndex(record.startedAtTick),
        endedAtMacroHourIndex: decodeNullableMacroHourIndex(record.endedAtTick),
      };
}

function decodeHousehold(record: LegacyHouseholdRecord): HouseholdRecord {
  return {
    householdId: record.householdId,
    foundedAtMacroHourIndex: decodeMacroHourIndex(record.foundedAtTick),
    dissolvedAtMacroHourIndex: decodeNullableMacroHourIndex(record.dissolvedAtTick),
  };
}

function decodeMembership(record: LegacyHouseholdMembershipRecord): HouseholdMembershipRecord {
  return {
    membershipId: record.membershipId,
    householdId: record.householdId,
    citizenId: record.citizenId,
    startedAtMacroHourIndex: decodeMacroHourIndex(record.startedAtTick),
    endedAtMacroHourIndex: decodeNullableMacroHourIndex(record.endedAtTick),
    endReasonDefinitionId: record.endReasonDefinitionId,
  };
}

function decodeDwelling(record: LegacyDwellingUnitRecord): DwellingUnitRecord {
  return {
    dwellingUnitId: record.dwellingUnitId,
    buildingInstanceId: record.buildingInstanceId,
    capacityProfileDefinitionId: record.capacityProfileDefinitionId,
    unitIndex: record.unitIndex,
    activatedAtMacroHourIndex: decodeMacroHourIndex(record.activatedAtTick),
    retiredAtMacroHourIndex: decodeNullableMacroHourIndex(record.retiredAtTick),
  };
}

function decodeHousingAssignment(record: LegacyHousingAssignmentRecord): HousingAssignmentRecord {
  return {
    housingAssignmentId: record.housingAssignmentId,
    householdId: record.householdId,
    dwellingUnitId: record.dwellingUnitId,
    startedAtMacroHourIndex: decodeMacroHourIndex(record.startedAtTick),
    endedAtMacroHourIndex: decodeNullableMacroHourIndex(record.endedAtTick),
    endReasonDefinitionId: record.endReasonDefinitionId,
  };
}

function decodeWorkplace(record: LegacyWorkplaceRecord): WorkplaceRecord {
  return {
    workplaceId: record.workplaceId,
    buildingInstanceId: record.buildingInstanceId,
    capacityProfileDefinitionId: record.capacityProfileDefinitionId,
    activatedAtMacroHourIndex: decodeMacroHourIndex(record.activatedAtTick),
    retiredAtMacroHourIndex: decodeNullableMacroHourIndex(record.retiredAtTick),
  };
}

function decodeEmploymentAssignment(
  record: LegacyEmploymentAssignmentRecord,
): EmploymentAssignmentRecord {
  return {
    employmentAssignmentId: record.employmentAssignmentId,
    citizenId: record.citizenId,
    workplaceId: record.workplaceId,
    positionGroupDefinitionId: record.positionGroupDefinitionId,
    startedAtMacroHourIndex: decodeMacroHourIndex(record.startedAtTick),
    endedAtMacroHourIndex: decodeNullableMacroHourIndex(record.endedAtTick),
    endReasonDefinitionId: record.endReasonDefinitionId,
  };
}

function decodeIncomingRequest(record: LegacyIncomingHouseholdRequest): IncomingHouseholdRequest {
  return {
    requestId: record.requestId,
    archetypeDefinitionId: record.archetypeDefinitionId,
    requestedAtMacroHourIndex: decodeMacroHourIndex(record.requestedAtTick),
    minimumResidentCapacity: record.minimumResidentCapacity,
    queuePriority: record.queuePriority,
    deterministicSequence: record.deterministicSequence,
  };
}

function decodeDisplacedEntry(record: LegacyDisplacedHouseholdEntry): DisplacedHouseholdEntry {
  return {
    householdId: record.householdId,
    displacedAtMacroHourIndex: decodeMacroHourIndex(record.displacedAtTick),
    expiresAtMacroHourIndex: decodeMacroHourIndex(record.expiresAtTick),
    minimumResidentCapacity: record.minimumResidentCapacity,
    displacementPressure: record.displacementPressure,
    deterministicSequence: record.deterministicSequence,
  };
}

function decodeDemand(record: LegacyRciDemandState): RciDemandState {
  return {
    residentialMilli: record.residentialMilli,
    commercialMilli: record.commercialMilli,
    industrialMilli: record.industrialMilli,
    evaluatedAtMacroHourIndex: decodeMacroHourIndex(record.evaluatedAtTick),
  };
}

function decodeGrowthGates(record: LegacyRciGrowthGateState): RciGrowthGateState {
  return {
    residentialOpen: record.residentialOpen,
    commercialOpen: record.commercialOpen,
    industrialOpen: record.industrialOpen,
    evaluatedAtMacroHourIndex: decodeMacroHourIndex(record.evaluatedAtTick),
  };
}

function encodeCitizen(
  record: CitizenRecord,
  currentMacroHourIndex: MacroHourIndex,
): LegacyCitizenRecord {
  return Object.freeze({
    citizenId: record.citizenId,
    presence: record.presence,
    sexDefinitionId: record.sexDefinitionId,
    bornAtTick: encodeAgeOriginAsLegacyMacroHour({
      ageOriginMacroHour: record.bornAtMacroHourIndex,
      currentMacroHour: currentMacroHourIndex,
    }),
    movedIntoCityAtTick: macroHourValue(record.movedIntoCityAtMacroHourIndex),
    movedOutOfCityAtTick:
      record.movedOutOfCityAtMacroHourIndex === null
        ? null
        : macroHourValue(record.movedOutOfCityAtMacroHourIndex),
    diedAtTick:
      record.diedAtMacroHourIndex === null ? null : macroHourValue(record.diedAtMacroHourIndex),
  });
}

function encodeHousehold(record: HouseholdRecord): LegacyHouseholdRecord {
  return Object.freeze({
    householdId: record.householdId,
    foundedAtTick: macroHourValue(record.foundedAtMacroHourIndex),
    dissolvedAtTick:
      record.dissolvedAtMacroHourIndex === null
        ? null
        : macroHourValue(record.dissolvedAtMacroHourIndex),
  });
}

function encodeMembership(record: HouseholdMembershipRecord): LegacyHouseholdMembershipRecord {
  return Object.freeze({
    membershipId: record.membershipId,
    householdId: record.householdId,
    citizenId: record.citizenId,
    startedAtTick: macroHourValue(record.startedAtMacroHourIndex),
    endedAtTick:
      record.endedAtMacroHourIndex === null ? null : macroHourValue(record.endedAtMacroHourIndex),
    endReasonDefinitionId: record.endReasonDefinitionId,
  });
}

function encodeRelationship(record: RelationshipRecord): LegacyRelationshipRecord {
  return record.orientation === 'directional'
    ? Object.freeze({
        relationshipId: record.relationshipId,
        orientation: record.orientation,
        typeDefinitionId: record.typeDefinitionId,
        sourceCitizenId: record.sourceCitizenId,
        targetCitizenId: record.targetCitizenId,
        startedAtTick: macroHourValue(record.startedAtMacroHourIndex),
        endedAtTick:
          record.endedAtMacroHourIndex === null
            ? null
            : macroHourValue(record.endedAtMacroHourIndex),
      })
    : Object.freeze({
        relationshipId: record.relationshipId,
        orientation: record.orientation,
        typeDefinitionId: record.typeDefinitionId,
        participantCitizenIds: record.participantCitizenIds,
        startedAtTick: macroHourValue(record.startedAtMacroHourIndex),
        endedAtTick:
          record.endedAtMacroHourIndex === null
            ? null
            : macroHourValue(record.endedAtMacroHourIndex),
      });
}

function encodeQualification(record: CitizenQualificationRecord): LegacyCitizenQualificationRecord {
  return Object.freeze({
    citizenQualificationId: record.citizenQualificationId,
    citizenId: record.citizenId,
    qualificationDefinitionId: record.qualificationDefinitionId,
    awardedAtTick: macroHourValue(record.awardedAtMacroHourIndex),
    endedAtTick:
      record.endedAtMacroHourIndex === null ? null : macroHourValue(record.endedAtMacroHourIndex),
    sourceDefinitionId: record.sourceDefinitionId,
  });
}

function encodeDwelling(record: DwellingUnitRecord): LegacyDwellingUnitRecord {
  return Object.freeze({
    dwellingUnitId: record.dwellingUnitId,
    buildingInstanceId: record.buildingInstanceId,
    capacityProfileDefinitionId: record.capacityProfileDefinitionId,
    unitIndex: record.unitIndex,
    activatedAtTick: macroHourValue(record.activatedAtMacroHourIndex),
    retiredAtTick:
      record.retiredAtMacroHourIndex === null
        ? null
        : macroHourValue(record.retiredAtMacroHourIndex),
  });
}

function encodeHousingAssignment(record: HousingAssignmentRecord): LegacyHousingAssignmentRecord {
  return Object.freeze({
    housingAssignmentId: record.housingAssignmentId,
    householdId: record.householdId,
    dwellingUnitId: record.dwellingUnitId,
    startedAtTick: macroHourValue(record.startedAtMacroHourIndex),
    endedAtTick:
      record.endedAtMacroHourIndex === null ? null : macroHourValue(record.endedAtMacroHourIndex),
    endReasonDefinitionId: record.endReasonDefinitionId,
  });
}

function encodeWorkplace(record: WorkplaceRecord): LegacyWorkplaceRecord {
  return Object.freeze({
    workplaceId: record.workplaceId,
    buildingInstanceId: record.buildingInstanceId,
    capacityProfileDefinitionId: record.capacityProfileDefinitionId,
    activatedAtTick: macroHourValue(record.activatedAtMacroHourIndex),
    retiredAtTick:
      record.retiredAtMacroHourIndex === null
        ? null
        : macroHourValue(record.retiredAtMacroHourIndex),
  });
}

function encodeEmploymentAssignment(
  record: EmploymentAssignmentRecord,
): LegacyEmploymentAssignmentRecord {
  return Object.freeze({
    employmentAssignmentId: record.employmentAssignmentId,
    citizenId: record.citizenId,
    workplaceId: record.workplaceId,
    positionGroupDefinitionId: record.positionGroupDefinitionId,
    startedAtTick: macroHourValue(record.startedAtMacroHourIndex),
    endedAtTick:
      record.endedAtMacroHourIndex === null ? null : macroHourValue(record.endedAtMacroHourIndex),
    endReasonDefinitionId: record.endReasonDefinitionId,
  });
}

function encodeIncomingRequest(record: IncomingHouseholdRequest): LegacyIncomingHouseholdRequest {
  return Object.freeze({
    requestId: record.requestId,
    archetypeDefinitionId: record.archetypeDefinitionId,
    requestedAtTick: macroHourValue(record.requestedAtMacroHourIndex),
    minimumResidentCapacity: record.minimumResidentCapacity,
    queuePriority: record.queuePriority,
    deterministicSequence: record.deterministicSequence,
  });
}

function encodeDisplacedEntry(record: DisplacedHouseholdEntry): LegacyDisplacedHouseholdEntry {
  return Object.freeze({
    householdId: record.householdId,
    displacedAtTick: macroHourValue(record.displacedAtMacroHourIndex),
    expiresAtTick: macroHourValue(record.expiresAtMacroHourIndex),
    minimumResidentCapacity: record.minimumResidentCapacity,
    displacementPressure: record.displacementPressure,
    deterministicSequence: record.deterministicSequence,
  });
}

function encodeDemand(record: RciDemandState): LegacyRciDemandState {
  return Object.freeze({
    residentialMilli: record.residentialMilli,
    commercialMilli: record.commercialMilli,
    industrialMilli: record.industrialMilli,
    evaluatedAtTick: macroHourValue(record.evaluatedAtMacroHourIndex),
  });
}

function encodeGrowthGates(record: RciGrowthGateState): LegacyRciGrowthGateState {
  return Object.freeze({
    residentialOpen: record.residentialOpen,
    commercialOpen: record.commercialOpen,
    industrialOpen: record.industrialOpen,
    evaluatedAtTick: macroHourValue(record.evaluatedAtMacroHourIndex),
  });
}

export function encodeRciSaveV1(
  input: RciSnapshot,
  currentMacroHourIndex: MacroHourIndex = input.demand.demand.evaluatedAtMacroHourIndex,
): RciSaveV1 {
  const snapshot = canonicalizeRciSnapshot(input);
  return Object.freeze({
    kind: 'rci-save',
    schemaVersion: 1,
    deterministicSeed: snapshot.deterministicSeed,
    rootRevision: snapshot.revision,
    populationRevision: snapshot.population.revision,
    relationshipRevision: snapshot.relationships.revision,
    householdRevision: snapshot.households.revision,
    housingRevision: snapshot.housing.revision,
    employmentRevision: snapshot.employment.revision,
    migrationRevision: snapshot.migration.revision,
    demandRevision: snapshot.demand.revision,
    population: Object.freeze({
      citizens: Object.freeze(
        snapshot.population.citizens.map((record) => encodeCitizen(record, currentMacroHourIndex)),
      ),
      qualifications: Object.freeze(snapshot.population.qualifications.map(encodeQualification)),
    }),
    relationships: Object.freeze(snapshot.relationships.relationships.map(encodeRelationship)),
    households: Object.freeze({
      households: Object.freeze(snapshot.households.households.map(encodeHousehold)),
      memberships: Object.freeze(snapshot.households.memberships.map(encodeMembership)),
    }),
    housing: Object.freeze({
      dwellingUnits: Object.freeze(snapshot.housing.dwellingUnits.map(encodeDwelling)),
      assignments: Object.freeze(snapshot.housing.assignments.map(encodeHousingAssignment)),
    }),
    employment: Object.freeze({
      workplaces: Object.freeze(snapshot.employment.workplaces.map(encodeWorkplace)),
      assignments: Object.freeze(snapshot.employment.assignments.map(encodeEmploymentAssignment)),
    }),
    migration: Object.freeze({
      incomingRequests: Object.freeze(
        snapshot.migration.incomingRequests.map(encodeIncomingRequest),
      ),
      displacedHouseholds: Object.freeze(
        snapshot.migration.displacedHouseholds.map(encodeDisplacedEntry),
      ),
      attractionMilli: snapshot.migration.attractionMilli,
    }),
    demand: encodeDemand(snapshot.demand.demand),
    growthGates: encodeGrowthGates(snapshot.demand.growthGates),
    sequences: snapshot.sequences,
  });
}

function hasSaveShape(input: Record<string, unknown>): boolean {
  return (
    input.kind === 'rci-save' &&
    input.schemaVersion === 1 &&
    isRecord(input.population) &&
    Array.isArray(input.relationships) &&
    isRecord(input.households) &&
    isRecord(input.housing) &&
    isRecord(input.employment) &&
    isRecord(input.migration) &&
    isRecord(input.demand) &&
    isRecord(input.growthGates) &&
    isRecord(input.sequences) &&
    Array.isArray(input.population.citizens) &&
    Array.isArray(input.population.qualifications) &&
    Array.isArray(input.households.households) &&
    Array.isArray(input.households.memberships) &&
    Array.isArray(input.housing.dwellingUnits) &&
    Array.isArray(input.housing.assignments) &&
    Array.isArray(input.employment.workplaces) &&
    Array.isArray(input.employment.assignments) &&
    Array.isArray(input.migration.incomingRequests) &&
    Array.isArray(input.migration.displacedHouseholds)
  );
}

function errorForContract(error: RciContractError): RciSaveError {
  if (error.code === 'rci:unknown-definition') {
    return Object.freeze({ code: 'rci-save:unknown-definition' });
  }
  if (error.code.startsWith('rci:dangling-')) {
    return Object.freeze({ code: 'rci-save:dangling-reference' });
  }
  if (error.code === 'rci:sequence-overflow') {
    return Object.freeze({ code: 'rci-save:invalid-sequence' });
  }
  return Object.freeze({ code: 'rci-save:invalid-state' });
}

export function decodeRciSaveV1(
  input: unknown,
  context: RciValidationContext,
): Result<RciSnapshot, RciSaveError> {
  if (!isRecord(input) || !hasSaveShape(input)) {
    return err(Object.freeze({ code: 'rci-save:invalid-schema' }));
  }
  const save = input as unknown as RciSaveV1;
  try {
    const currentMacroHourIndex = deriveMacroHourIndex(context.simulation.absoluteGameMinute);
    return ok(
      createRciSnapshot(
        {
          revision: save.rootRevision,
          deterministicSeed: save.deterministicSeed,
          population: {
            revision: save.populationRevision,
            citizens: save.population.citizens.map((record) =>
              decodeCitizen(record, currentMacroHourIndex),
            ),
            qualifications: save.population.qualifications.map(decodeQualification),
          },
          relationships: {
            revision: save.relationshipRevision,
            relationships: save.relationships.map(decodeRelationship),
          },
          households: {
            revision: save.householdRevision,
            households: save.households.households.map(decodeHousehold),
            memberships: save.households.memberships.map(decodeMembership),
          },
          housing: {
            revision: save.housingRevision,
            dwellingUnits: save.housing.dwellingUnits.map(decodeDwelling),
            assignments: save.housing.assignments.map(decodeHousingAssignment),
          },
          employment: {
            revision: save.employmentRevision,
            workplaces: save.employment.workplaces.map(decodeWorkplace),
            assignments: save.employment.assignments.map(decodeEmploymentAssignment),
          },
          migration: {
            revision: save.migrationRevision,
            incomingRequests: save.migration.incomingRequests.map(decodeIncomingRequest),
            displacedHouseholds: save.migration.displacedHouseholds.map(decodeDisplacedEntry),
            attractionMilli: save.migration.attractionMilli,
          },
          demand: {
            revision: save.demandRevision,
            demand: decodeDemand(save.demand),
            growthGates: decodeGrowthGates(save.growthGates),
          },
          sequences: save.sequences,
        },
        context,
      ),
    );
  } catch (error) {
    return error instanceof RciContractError
      ? err(errorForContract(error))
      : err(Object.freeze({ code: 'rci-save:invalid-schema' }));
  }
}
