import { err, ok, type Result } from '@web-three-city/world-core';
import { RciContractError } from '../contracts/errors.js';
import type {
  CitizenQualificationRecord,
  CitizenRecord,
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
  WorkplaceRecord,
} from '../contracts/records.js';
import {
  canonicalizeRciSnapshot,
  createRciSnapshot,
  type RciSequenceState,
  type RciSnapshot,
  type RciValidationContext,
} from '../rci-snapshot.js';

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
    citizens: readonly CitizenRecord[];
    qualifications: readonly CitizenQualificationRecord[];
  }>;
  readonly relationships: readonly RelationshipRecord[];
  readonly households: Readonly<{
    households: readonly HouseholdRecord[];
    memberships: readonly HouseholdMembershipRecord[];
  }>;
  readonly housing: Readonly<{
    dwellingUnits: readonly DwellingUnitRecord[];
    assignments: readonly HousingAssignmentRecord[];
  }>;
  readonly employment: Readonly<{
    workplaces: readonly WorkplaceRecord[];
    assignments: readonly EmploymentAssignmentRecord[];
  }>;
  readonly migration: Readonly<{
    incomingRequests: readonly IncomingHouseholdRequest[];
    displacedHouseholds: readonly DisplacedHouseholdEntry[];
    attractionMilli: number;
  }>;
  readonly demand: RciDemandState;
  readonly growthGates: RciGrowthGateState;
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

export function encodeRciSaveV1(input: RciSnapshot): RciSaveV1 {
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
      citizens: snapshot.population.citizens,
      qualifications: snapshot.population.qualifications,
    }),
    relationships: snapshot.relationships.relationships,
    households: Object.freeze({
      households: snapshot.households.households,
      memberships: snapshot.households.memberships,
    }),
    housing: Object.freeze({
      dwellingUnits: snapshot.housing.dwellingUnits,
      assignments: snapshot.housing.assignments,
    }),
    employment: Object.freeze({
      workplaces: snapshot.employment.workplaces,
      assignments: snapshot.employment.assignments,
    }),
    migration: Object.freeze({
      incomingRequests: snapshot.migration.incomingRequests,
      displacedHouseholds: snapshot.migration.displacedHouseholds,
      attractionMilli: snapshot.migration.attractionMilli,
    }),
    demand: snapshot.demand.demand,
    growthGates: snapshot.demand.growthGates,
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
    return ok(
      createRciSnapshot(
        {
          revision: save.rootRevision,
          deterministicSeed: save.deterministicSeed,
          population: {
            revision: save.populationRevision,
            citizens: save.population.citizens,
            qualifications: save.population.qualifications,
          },
          relationships: {
            revision: save.relationshipRevision,
            relationships: save.relationships,
          },
          households: {
            revision: save.householdRevision,
            households: save.households.households,
            memberships: save.households.memberships,
          },
          housing: {
            revision: save.housingRevision,
            dwellingUnits: save.housing.dwellingUnits,
            assignments: save.housing.assignments,
          },
          employment: {
            revision: save.employmentRevision,
            workplaces: save.employment.workplaces,
            assignments: save.employment.assignments,
          },
          migration: {
            revision: save.migrationRevision,
            incomingRequests: save.migration.incomingRequests,
            displacedHouseholds: save.migration.displacedHouseholds,
            attractionMilli: save.migration.attractionMilli,
          },
          demand: {
            revision: save.demandRevision,
            demand: save.demand,
            growthGates: save.growthGates,
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
