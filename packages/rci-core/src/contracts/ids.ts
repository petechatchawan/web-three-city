import { RciContractError } from './errors.js';

export type CitizenId = string;
export type HouseholdId = string;
export type HouseholdMembershipId = string;
export type RelationshipId = string;
export type CitizenQualificationId = string;
export type DwellingUnitId = string;
export type HousingAssignmentId = string;
export type WorkplaceId = string;
export type EmploymentAssignmentId = string;
export type IncomingHouseholdRequestId = string;
export type DefinitionId = string;
export type SexDefinitionId = string;
export type RelationshipTypeDefinitionId = string;
export type QualificationDefinitionId = string;
export type EmploymentRequirementDefinitionId = string;
export type PositionGroupDefinitionId = string;
export type OccupationDefinitionId = string;
export type MigrationArchetypeDefinitionId = string;
export type DemandFactorDefinitionId = string;
export type CapacityProfileDefinitionId = string;

export function compareStableId(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

export function canonicalCitizenPair(
  first: CitizenId,
  second: CitizenId,
): readonly [CitizenId, CitizenId] {
  if (first === second) {
    throw new RciContractError('rci:invalid-relationship');
  }
  return Object.freeze(compareStableId(first, second) < 0 ? [first, second] : [second, first]);
}
