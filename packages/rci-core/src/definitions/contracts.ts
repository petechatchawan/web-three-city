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

export interface MigrationArchetypeDefinition {
  readonly id: string;
  readonly version: number;
}

export interface CapacityProfileDefinition {
  readonly id: string;
  readonly kind: 'residential' | 'commercial' | 'industrial';
}

export interface DemandFactorDefinitionContract {
  readonly id: string;
}

export interface PopulationRateProfileDefinition {
  readonly id: string;
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
