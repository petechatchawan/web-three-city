export interface DefinitionRegistry<T extends Readonly<{ id: string }>> {
  get(id: string): T;
  has(id: string): boolean;
  values(): readonly T[];
}

export interface SexDefinition {
  readonly id: string;
  readonly label: string;
}

export interface RelationshipTypeDefinition {
  readonly id: string;
  readonly orientation: 'directional' | 'undirected';
  readonly historicalPolicy: 'permanent' | 'endable';
  readonly cardinalityPolicyDefinitionId: string;
}

export interface QualificationDefinition {
  readonly id: string;
  readonly label: string;
  readonly rank: number;
}

export interface EmploymentRequirementDefinition {
  readonly id: string;
  readonly kind: 'minimum-qualification-rank';
  readonly minimumQualificationDefinitionId: string;
}

export interface PositionGroupDefinition {
  readonly id: string;
  readonly label: string;
  readonly employmentRequirementDefinitionId: string;
  readonly occupationDefinitionId: string | null;
}

export interface OccupationDefinition {
  readonly id: string;
  readonly label: string;
}

export interface PositionGroupCapacityDefinition {
  readonly positionGroupDefinitionId: string;
  readonly capacity: number;
  readonly employmentRequirementDefinitionId: string;
  readonly occupationDefinitionId: string | null;
}

export interface ResidentialCapacityProfileDefinition {
  readonly id: string;
  readonly kind: 'residential';
  readonly dwellingUnitCount: number;
  readonly residentCapacityPerUnit: number;
}

export interface WorkplaceCapacityProfileDefinition {
  readonly id: string;
  readonly kind: 'commercial' | 'industrial';
  readonly positionGroups: readonly PositionGroupCapacityDefinition[];
}

export type CapacityProfileDefinition =
  ResidentialCapacityProfileDefinition | WorkplaceCapacityProfileDefinition;

export interface MigrationAgeRangeDefinition {
  readonly minimumYears: number;
  readonly maximumYears: number;
}

export interface MigrationArchetypeDefinition {
  readonly id: string;
  readonly version: number;
  readonly memberCount: number;
  readonly adultCount: number;
  readonly childCount: number;
  readonly partneredAdults: boolean;
  readonly minimumResidentCapacity: number;
  readonly weight: number;
  readonly adultAgeRange: MigrationAgeRangeDefinition;
  readonly childAgeRange: MigrationAgeRangeDefinition;
  readonly femaleProbabilityMillionth: number;
}

export interface DemandFactorDefinitionContract {
  readonly id: string;
}

export interface AnnualRateBandDefinition {
  readonly minAge: number;
  readonly maxAge: number | null;
  readonly annualRateMillionth: number;
}

export interface PopulationRateProfileDefinition {
  readonly id: string;
  readonly fertilityEligibleSexDefinitionIds: readonly string[];
  readonly fertilityBands: readonly AnnualRateBandDefinition[];
  readonly mortalityBands: readonly AnnualRateBandDefinition[];
}

export interface RciDefinitionRegistries {
  readonly sexes: DefinitionRegistry<SexDefinition>;
  readonly relationshipTypes: DefinitionRegistry<RelationshipTypeDefinition>;
  readonly qualifications: DefinitionRegistry<QualificationDefinition>;
  readonly employmentRequirements: DefinitionRegistry<EmploymentRequirementDefinition>;
  readonly positionGroups: DefinitionRegistry<PositionGroupDefinition>;
  readonly occupations: DefinitionRegistry<OccupationDefinition>;
  readonly migrationArchetypes: DefinitionRegistry<MigrationArchetypeDefinition>;
  readonly capacityProfiles: DefinitionRegistry<CapacityProfileDefinition>;
  readonly demandFactors: DefinitionRegistry<DemandFactorDefinitionContract>;
  readonly populationRateProfiles: DefinitionRegistry<PopulationRateProfileDefinition>;
}

export interface RciDefinitionExtensions {
  readonly sexes?: readonly SexDefinition[];
  readonly relationshipTypes?: readonly RelationshipTypeDefinition[];
  readonly qualifications?: readonly QualificationDefinition[];
  readonly employmentRequirements?: readonly EmploymentRequirementDefinition[];
  readonly positionGroups?: readonly PositionGroupDefinition[];
  readonly occupations?: readonly OccupationDefinition[];
  readonly migrationArchetypes?: readonly MigrationArchetypeDefinition[];
  readonly capacityProfiles?: readonly CapacityProfileDefinition[];
  readonly demandFactors?: readonly DemandFactorDefinitionContract[];
  readonly populationRateProfiles?: readonly PopulationRateProfileDefinition[];
}
