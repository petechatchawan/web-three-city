import { RciContractError } from '../contracts/errors.js';
import type {
  AnnualRateBandDefinition,
  EmploymentRequirementDefinition,
  PopulationRateProfileDefinition,
  QualificationDefinition,
  RciDefinitionExtensions,
  RciDefinitionRegistries,
} from './contracts.js';
import { createDefinitionRegistry } from './definition-registry.js';

const FOUNDATION_SEXES = Object.freeze([
  Object.freeze({ id: 'sex.female', label: 'Female' }),
  Object.freeze({ id: 'sex.male', label: 'Male' }),
]);

const FOUNDATION_RELATIONSHIP_TYPES = Object.freeze([
  Object.freeze({
    id: 'relationship.parent.biological.father',
    orientation: 'directional' as const,
    historicalPolicy: 'permanent' as const,
    cardinalityPolicyDefinitionId: 'cardinality.parent.biological.father.v1',
  }),
  Object.freeze({
    id: 'relationship.parent.biological.mother',
    orientation: 'directional' as const,
    historicalPolicy: 'permanent' as const,
    cardinalityPolicyDefinitionId: 'cardinality.parent.biological.mother.v1',
  }),
  Object.freeze({
    id: 'relationship.partner',
    orientation: 'undirected' as const,
    historicalPolicy: 'endable' as const,
    cardinalityPolicyDefinitionId: 'cardinality.partner.single-active.v1',
  }),
]);

const FOUNDATION_QUALIFICATIONS: readonly QualificationDefinition[] = Object.freeze([
  Object.freeze({ id: 'qualification.entry', label: 'Entry', rank: 10 }),
  Object.freeze({ id: 'qualification.skilled', label: 'Skilled', rank: 20 }),
  Object.freeze({ id: 'qualification.professional', label: 'Professional', rank: 30 }),
]);

const FOUNDATION_EMPLOYMENT_REQUIREMENTS: readonly EmploymentRequirementDefinition[] =
  Object.freeze([
    Object.freeze({
      id: 'requirement.qualification.entry',
      kind: 'minimum-qualification-rank' as const,
      minimumQualificationDefinitionId: 'qualification.entry',
    }),
    Object.freeze({
      id: 'requirement.qualification.skilled',
      kind: 'minimum-qualification-rank' as const,
      minimumQualificationDefinitionId: 'qualification.skilled',
    }),
    Object.freeze({
      id: 'requirement.qualification.professional',
      kind: 'minimum-qualification-rank' as const,
      minimumQualificationDefinitionId: 'qualification.professional',
    }),
  ]);

const FOUNDATION_POPULATION_RATE_PROFILE: PopulationRateProfileDefinition = Object.freeze({
  id: 'population-rate.synthetic.v1',
  fertilityEligibleSexDefinitionIds: Object.freeze(['sex.female']),
  fertilityBands: Object.freeze([
    Object.freeze({ minAge: 0, maxAge: 14, annualRateMillionth: 0 }),
    Object.freeze({ minAge: 15, maxAge: 19, annualRateMillionth: 25_000 }),
    Object.freeze({ minAge: 20, maxAge: 24, annualRateMillionth: 70_000 }),
    Object.freeze({ minAge: 25, maxAge: 29, annualRateMillionth: 90_000 }),
    Object.freeze({ minAge: 30, maxAge: 34, annualRateMillionth: 75_000 }),
    Object.freeze({ minAge: 35, maxAge: 39, annualRateMillionth: 40_000 }),
    Object.freeze({ minAge: 40, maxAge: 44, annualRateMillionth: 10_000 }),
    Object.freeze({ minAge: 45, maxAge: 49, annualRateMillionth: 1_000 }),
    Object.freeze({ minAge: 50, maxAge: null, annualRateMillionth: 0 }),
  ]),
  mortalityBands: Object.freeze([
    Object.freeze({ minAge: 0, maxAge: 0, annualRateMillionth: 4_000 }),
    Object.freeze({ minAge: 1, maxAge: 5, annualRateMillionth: 300 }),
    Object.freeze({ minAge: 6, maxAge: 17, annualRateMillionth: 150 }),
    Object.freeze({ minAge: 18, maxAge: 34, annualRateMillionth: 500 }),
    Object.freeze({ minAge: 35, maxAge: 49, annualRateMillionth: 1_500 }),
    Object.freeze({ minAge: 50, maxAge: 64, annualRateMillionth: 6_000 }),
    Object.freeze({ minAge: 65, maxAge: 74, annualRateMillionth: 20_000 }),
    Object.freeze({ minAge: 75, maxAge: 84, annualRateMillionth: 60_000 }),
    Object.freeze({ minAge: 85, maxAge: 99, annualRateMillionth: 150_000 }),
    Object.freeze({ minAge: 100, maxAge: null, annualRateMillionth: 300_000 }),
  ]),
});

function combined<T>(foundation: readonly T[], extensions: readonly T[] | undefined): readonly T[] {
  return Object.freeze([...foundation, ...(extensions ?? [])]);
}

function freezeBand(band: AnnualRateBandDefinition): AnnualRateBandDefinition {
  if (
    !Number.isSafeInteger(band.minAge) ||
    band.minAge < 0 ||
    (band.maxAge !== null &&
      (!Number.isSafeInteger(band.maxAge) || band.maxAge < band.minAge)) ||
    !Number.isSafeInteger(band.annualRateMillionth) ||
    band.annualRateMillionth < 0 ||
    band.annualRateMillionth > 1_000_000
  ) {
    throw new RciContractError('rci:unknown-definition');
  }
  return Object.freeze({ ...band });
}

function freezeRateProfile(
  profile: PopulationRateProfileDefinition,
): PopulationRateProfileDefinition {
  return Object.freeze({
    ...profile,
    fertilityEligibleSexDefinitionIds: Object.freeze([
      ...profile.fertilityEligibleSexDefinitionIds,
    ]),
    fertilityBands: Object.freeze(profile.fertilityBands.map(freezeBand)),
    mortalityBands: Object.freeze(profile.mortalityBands.map(freezeBand)),
  });
}

export function createFoundationRciRegistries(
  extensions: RciDefinitionExtensions = {},
): RciDefinitionRegistries {
  const sexes = createDefinitionRegistry(combined(FOUNDATION_SEXES, extensions.sexes));
  const relationshipTypes = createDefinitionRegistry(
    combined(FOUNDATION_RELATIONSHIP_TYPES, extensions.relationshipTypes),
  );
  const qualifications = createDefinitionRegistry(
    combined(FOUNDATION_QUALIFICATIONS, extensions.qualifications),
  );
  for (const qualification of qualifications.values()) {
    if (!Number.isSafeInteger(qualification.rank) || qualification.rank < 0) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  const employmentRequirements = createDefinitionRegistry(
    combined(FOUNDATION_EMPLOYMENT_REQUIREMENTS, extensions.employmentRequirements),
  );
  for (const requirement of employmentRequirements.values()) {
    if (!qualifications.has(requirement.minimumQualificationDefinitionId)) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  const occupations = createDefinitionRegistry(extensions.occupations ?? []);
  const positionGroups = createDefinitionRegistry(extensions.positionGroups ?? []);
  for (const group of positionGroups.values()) {
    if (
      !employmentRequirements.has(group.employmentRequirementDefinitionId) ||
      (group.occupationDefinitionId !== null && !occupations.has(group.occupationDefinitionId))
    ) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  const populationRateProfiles = createDefinitionRegistry(
    combined(
      [FOUNDATION_POPULATION_RATE_PROFILE],
      extensions.populationRateProfiles?.map(freezeRateProfile),
    ),
  );
  for (const profile of populationRateProfiles.values()) {
    for (const sexId of profile.fertilityEligibleSexDefinitionIds) {
      if (!sexes.has(sexId)) throw new RciContractError('rci:unknown-definition');
    }
    if (profile.fertilityBands.length === 0 || profile.mortalityBands.length === 0) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  return Object.freeze({
    sexes,
    relationshipTypes,
    qualifications,
    employmentRequirements,
    positionGroups,
    occupations,
    migrationArchetypes: createDefinitionRegistry(extensions.migrationArchetypes ?? []),
    capacityProfiles: createDefinitionRegistry(extensions.capacityProfiles ?? []),
    demandFactors: createDefinitionRegistry(extensions.demandFactors ?? []),
    populationRateProfiles,
  });
}
