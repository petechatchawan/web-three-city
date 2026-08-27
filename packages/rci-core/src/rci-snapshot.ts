import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { RciContractError } from './contracts/errors.js';
import { compareStableId } from './contracts/ids.js';
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
} from './contracts/records.js';
import type { RciDefinitionRegistries } from './definitions/contracts.js';
import { validateRciSnapshot } from './validation/rci-validation.js';

export const DEFAULT_RCI_DETERMINISTIC_SEED = 1;

export interface PopulationSnapshot {
  readonly revision: number;
  readonly citizens: readonly CitizenRecord[];
  readonly qualifications: readonly CitizenQualificationRecord[];
}

export interface RelationshipSnapshot {
  readonly revision: number;
  readonly relationships: readonly RelationshipRecord[];
}

export interface HouseholdSnapshot {
  readonly revision: number;
  readonly households: readonly HouseholdRecord[];
  readonly memberships: readonly HouseholdMembershipRecord[];
}

export interface HousingSnapshot {
  readonly revision: number;
  readonly dwellingUnits: readonly DwellingUnitRecord[];
  readonly assignments: readonly HousingAssignmentRecord[];
}

export interface EmploymentSnapshot {
  readonly revision: number;
  readonly workplaces: readonly WorkplaceRecord[];
  readonly assignments: readonly EmploymentAssignmentRecord[];
}

export interface MigrationSnapshot {
  readonly revision: number;
  readonly incomingRequests: readonly IncomingHouseholdRequest[];
  readonly displacedHouseholds: readonly DisplacedHouseholdEntry[];
  readonly attractionMilli: number;
}

export interface RciDemandSnapshot {
  readonly revision: number;
  readonly demand: RciDemandState;
  readonly growthGates: RciGrowthGateState;
}

export interface RciSequenceState {
  readonly nextCitizen: number;
  readonly nextHousehold: number;
  readonly nextHouseholdMembership: number;
  readonly nextRelationship: number;
  readonly nextCitizenQualification: number;
  readonly nextHousingAssignment: number;
  readonly nextEmploymentAssignment: number;
  readonly nextIncomingRequest: number;
  readonly nextDomainEvent: number;
}

export interface RciSnapshot {
  readonly revision: number;
  readonly deterministicSeed: number;
  readonly population: PopulationSnapshot;
  readonly relationships: RelationshipSnapshot;
  readonly households: HouseholdSnapshot;
  readonly housing: HousingSnapshot;
  readonly employment: EmploymentSnapshot;
  readonly migration: MigrationSnapshot;
  readonly demand: RciDemandSnapshot;
  readonly sequences: RciSequenceState;
}

export interface RciValidationContext {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly registries: RciDefinitionRegistries;
}

function freezeRecord<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function freezeSorted<T extends object>(
  values: readonly T[],
  idFor: (value: T) => string,
): readonly Readonly<T>[] {
  return Object.freeze(
    values
      .map((value) => freezeRecord(value))
      .sort((first, second) => compareStableId(idFor(first as T), idFor(second as T))),
  );
}

function canonicalRelationships(
  values: readonly RelationshipRecord[],
): readonly RelationshipRecord[] {
  return Object.freeze(
    values
      .map((relationship) =>
        relationship.orientation === 'undirected'
          ? Object.freeze({
              ...relationship,
              participantCitizenIds: Object.freeze([
                ...relationship.participantCitizenIds,
              ]) as readonly [string, string],
            })
          : Object.freeze({ ...relationship }),
      )
      .sort((first, second) => compareStableId(first.relationshipId, second.relationshipId)),
  );
}

export function canonicalizeRciSnapshot(input: RciSnapshot): RciSnapshot {
  return Object.freeze({
    revision: input.revision,
    deterministicSeed: input.deterministicSeed,
    population: Object.freeze({
      revision: input.population.revision,
      citizens: freezeSorted(input.population.citizens, (value) => value.citizenId),
      qualifications: freezeSorted(
        input.population.qualifications,
        (value) => value.citizenQualificationId,
      ),
    }),
    relationships: Object.freeze({
      revision: input.relationships.revision,
      relationships: canonicalRelationships(input.relationships.relationships),
    }),
    households: Object.freeze({
      revision: input.households.revision,
      households: freezeSorted(input.households.households, (value) => value.householdId),
      memberships: freezeSorted(input.households.memberships, (value) => value.membershipId),
    }),
    housing: Object.freeze({
      revision: input.housing.revision,
      dwellingUnits: freezeSorted(input.housing.dwellingUnits, (value) => value.dwellingUnitId),
      assignments: freezeSorted(input.housing.assignments, (value) => value.housingAssignmentId),
    }),
    employment: Object.freeze({
      revision: input.employment.revision,
      workplaces: freezeSorted(input.employment.workplaces, (value) => value.workplaceId),
      assignments: freezeSorted(
        input.employment.assignments,
        (value) => value.employmentAssignmentId,
      ),
    }),
    migration: Object.freeze({
      revision: input.migration.revision,
      incomingRequests: freezeSorted(input.migration.incomingRequests, (value) => value.requestId),
      displacedHouseholds: freezeSorted(
        input.migration.displacedHouseholds,
        (value) => value.householdId,
      ),
      attractionMilli: input.migration.attractionMilli,
    }),
    demand: Object.freeze({
      revision: input.demand.revision,
      demand: freezeRecord(input.demand.demand),
      growthGates: freezeRecord(input.demand.growthGates),
    }),
    sequences: freezeRecord(input.sequences),
  });
}

export function createInitialRciSnapshot(input: {
  readonly absoluteMacroHourIndex: MacroHourIndex;
  readonly deterministicSeed?: number;
}): RciSnapshot {
  let absoluteMacroHourIndex: MacroHourIndex;
  try {
    absoluteMacroHourIndex = macroHourIndex(macroHourValue(input.absoluteMacroHourIndex));
  } catch {
    throw new RciContractError('rci:invalid-state');
  }
  const seed = input.deterministicSeed ?? DEFAULT_RCI_DETERMINISTIC_SEED;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  const empty = Object.freeze([]);
  return canonicalizeRciSnapshot({
    revision: 0,
    deterministicSeed: seed,
    population: { revision: 0, citizens: empty, qualifications: empty },
    relationships: { revision: 0, relationships: empty },
    households: { revision: 0, households: empty, memberships: empty },
    housing: { revision: 0, dwellingUnits: empty, assignments: empty },
    employment: { revision: 0, workplaces: empty, assignments: empty },
    migration: {
      revision: 0,
      incomingRequests: empty,
      displacedHouseholds: empty,
      attractionMilli: 0,
    },
    demand: {
      revision: 0,
      demand: {
        residentialMilli: 0,
        commercialMilli: 0,
        industrialMilli: 0,
        evaluatedAtMacroHourIndex: absoluteMacroHourIndex,
      },
      growthGates: {
        residentialOpen: false,
        commercialOpen: false,
        industrialOpen: false,
        evaluatedAtMacroHourIndex: absoluteMacroHourIndex,
      },
    },
    sequences: {
      nextCitizen: 1,
      nextHousehold: 1,
      nextHouseholdMembership: 1,
      nextRelationship: 1,
      nextCitizenQualification: 1,
      nextHousingAssignment: 1,
      nextEmploymentAssignment: 1,
      nextIncomingRequest: 1,
      nextDomainEvent: 1,
    },
  });
}

export function createRciSnapshot(input: RciSnapshot, context: RciValidationContext): RciSnapshot {
  const snapshot = canonicalizeRciSnapshot(input);
  const result = validateRciSnapshot(
    snapshot,
    context.buildings,
    context.simulation,
    context.registries,
  );
  if (!result.valid) {
    throw new RciContractError(result.issues[0]?.code ?? 'rci:invalid-state');
  }
  return snapshot;
}
