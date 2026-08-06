import { RciContractError } from '../contracts/errors.js';
import type {
  AnnualRateBandDefinition,
  CapacityProfileDefinition,
  EmploymentRequirementDefinition,
  MigrationArchetypeDefinition,
  PopulationRateProfileDefinition,
  PositionGroupDefinition,
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
  Object.freeze({ id: 'relationship.parent.biological.father', orientation: 'directional' as const, historicalPolicy: 'permanent' as const, cardinalityPolicyDefinitionId: 'cardinality.parent.biological.father.v1' }),
  Object.freeze({ id: 'relationship.parent.biological.mother', orientation: 'directional' as const, historicalPolicy: 'permanent' as const, cardinalityPolicyDefinitionId: 'cardinality.parent.biological.mother.v1' }),
  Object.freeze({ id: 'relationship.partner', orientation: 'undirected' as const, historicalPolicy: 'endable' as const, cardinalityPolicyDefinitionId: 'cardinality.partner.single-active.v1' }),
]);

const FOUNDATION_QUALIFICATIONS: readonly QualificationDefinition[] = Object.freeze([
  Object.freeze({ id: 'qualification.entry', label: 'Entry', rank: 10 }),
  Object.freeze({ id: 'qualification.skilled', label: 'Skilled', rank: 20 }),
  Object.freeze({ id: 'qualification.professional', label: 'Professional', rank: 30 }),
]);

const FOUNDATION_EMPLOYMENT_REQUIREMENTS: readonly EmploymentRequirementDefinition[] = Object.freeze([
  Object.freeze({ id: 'requirement.qualification.entry', kind: 'minimum-qualification-rank' as const, minimumQualificationDefinitionId: 'qualification.entry' }),
  Object.freeze({ id: 'requirement.qualification.skilled', kind: 'minimum-qualification-rank' as const, minimumQualificationDefinitionId: 'qualification.skilled' }),
  Object.freeze({ id: 'requirement.qualification.professional', kind: 'minimum-qualification-rank' as const, minimumQualificationDefinitionId: 'qualification.professional' }),
]);

const FOUNDATION_POSITION_GROUPS: readonly PositionGroupDefinition[] = Object.freeze([
  Object.freeze({ id: 'position.entry', label: 'Entry', employmentRequirementDefinitionId: 'requirement.qualification.entry', occupationDefinitionId: null }),
  Object.freeze({ id: 'position.skilled', label: 'Skilled', employmentRequirementDefinitionId: 'requirement.qualification.skilled', occupationDefinitionId: null }),
  Object.freeze({ id: 'position.professional', label: 'Professional', employmentRequirementDefinitionId: 'requirement.qualification.professional', occupationDefinitionId: null }),
]);

function workplace(
  id: string,
  kind: 'commercial' | 'industrial',
  capacities: readonly [number, number, number],
): CapacityProfileDefinition {
  const ids = ['entry', 'skilled', 'professional'] as const;
  return Object.freeze({
    id,
    kind,
    positionGroups: Object.freeze(
      capacities.flatMap((capacity, index) =>
        capacity === 0
          ? []
          : [
              Object.freeze({
                positionGroupDefinitionId: `position.${ids[index]}`,
                capacity,
                employmentRequirementDefinitionId: `requirement.qualification.${ids[index]}`,
                occupationDefinitionId: null,
              }),
            ],
      ),
    ),
  });
}

const FOUNDATION_CAPACITY_PROFILES: readonly CapacityProfileDefinition[] = Object.freeze([
  Object.freeze({ id: 'capacity.residential.cottage.v1', kind: 'residential' as const, dwellingUnitCount: 1, residentCapacityPerUnit: 4 }),
  Object.freeze({ id: 'capacity.residential.rowhouse.v1', kind: 'residential' as const, dwellingUnitCount: 1, residentCapacityPerUnit: 5 }),
  Object.freeze({ id: 'capacity.residential.duplex.v1', kind: 'residential' as const, dwellingUnitCount: 2, residentCapacityPerUnit: 4 }),
  Object.freeze({ id: 'capacity.residential.apartment.v1', kind: 'residential' as const, dwellingUnitCount: 6, residentCapacityPerUnit: 3 }),
  workplace('capacity.commercial.shop.v1', 'commercial', [3, 1, 0]),
  workplace('capacity.commercial.cafe.v1', 'commercial', [4, 2, 0]),
  workplace('capacity.commercial.market.v1', 'commercial', [7, 4, 1]),
  workplace('capacity.commercial.office.v1', 'commercial', [4, 8, 12]),
  workplace('capacity.industrial.workshop.v1', 'industrial', [6, 3, 1]),
  workplace('capacity.industrial.depot.v1', 'industrial', [4, 1, 0]),
  workplace('capacity.industrial.warehouse.v1', 'industrial', [12, 5, 1]),
  workplace('capacity.industrial.factory.v1', 'industrial', [16, 10, 4]),
]);

function archetype(
  id: string,
  adultCount: number,
  childCount: number,
  partneredAdults: boolean,
  weight: number,
  adultMinimumYears = 18,
  adultMaximumYears = 64,
): MigrationArchetypeDefinition {
  const memberCount = adultCount + childCount;
  return Object.freeze({
    id,
    version: 1,
    memberCount,
    adultCount,
    childCount,
    partneredAdults,
    minimumResidentCapacity: memberCount,
    weight,
    adultAgeRange: Object.freeze({ minimumYears: adultMinimumYears, maximumYears: adultMaximumYears }),
    childAgeRange: Object.freeze({ minimumYears: 0, maximumYears: 17 }),
    femaleProbabilityMillionth: 500_000,
  });
}

const FOUNDATION_MIGRATION_ARCHETYPES: readonly MigrationArchetypeDefinition[] = Object.freeze([
  archetype('migration.single-adult.v1', 1, 0, false, 30),
  archetype('migration.couple.v1', 2, 0, true, 25),
  archetype('migration.single-parent.v1', 1, 1, false, 15, 20, 55),
  archetype('migration.family-small.v1', 2, 1, true, 20, 22, 55),
  archetype('migration.family-large.v1', 2, 2, true, 10, 25, 55),
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
    (band.maxAge !== null && (!Number.isSafeInteger(band.maxAge) || band.maxAge < band.minAge)) ||
    !Number.isSafeInteger(band.annualRateMillionth) ||
    band.annualRateMillionth < 0 ||
    band.annualRateMillionth > 1_000_000
  ) {
    throw new RciContractError('rci:unknown-definition');
  }
  return Object.freeze({ ...band });
}

function freezeRateProfile(profile: PopulationRateProfileDefinition): PopulationRateProfileDefinition {
  return Object.freeze({
    ...profile,
    fertilityEligibleSexDefinitionIds: Object.freeze([...profile.fertilityEligibleSexDefinitionIds]),
    fertilityBands: Object.freeze(profile.fertilityBands.map(freezeBand)),
    mortalityBands: Object.freeze(profile.mortalityBands.map(freezeBand)),
  });
}

function freezeCapacityProfile(profile: CapacityProfileDefinition): CapacityProfileDefinition {
  if (profile.kind === 'residential') {
    if (
      !Number.isSafeInteger(profile.dwellingUnitCount) ||
      profile.dwellingUnitCount <= 0 ||
      !Number.isSafeInteger(profile.residentCapacityPerUnit) ||
      profile.residentCapacityPerUnit <= 0
    ) {
      throw new RciContractError('rci:unknown-definition');
    }
    return Object.freeze({ ...profile });
  }
  const groups = profile.positionGroups.map((group) => {
    if (!Number.isSafeInteger(group.capacity) || group.capacity <= 0) {
      throw new RciContractError('rci:unknown-definition');
    }
    return Object.freeze({ ...group });
  });
  if (groups.length === 0 || new Set(groups.map((group) => group.positionGroupDefinitionId)).size !== groups.length) {
    throw new RciContractError('rci:unknown-definition');
  }
  return Object.freeze({ ...profile, positionGroups: Object.freeze(groups) });
}

function freezeMigrationArchetype(archetype: MigrationArchetypeDefinition): MigrationArchetypeDefinition {
  if (
    !Number.isSafeInteger(archetype.version) || archetype.version < 1 ||
    !Number.isSafeInteger(archetype.memberCount) || archetype.memberCount < 1 ||
    !Number.isSafeInteger(archetype.adultCount) || archetype.adultCount < 1 ||
    !Number.isSafeInteger(archetype.childCount) || archetype.childCount < 0 ||
    archetype.adultCount + archetype.childCount !== archetype.memberCount ||
    !Number.isSafeInteger(archetype.minimumResidentCapacity) || archetype.minimumResidentCapacity < archetype.memberCount ||
    !Number.isSafeInteger(archetype.weight) || archetype.weight < 1 ||
    !Number.isSafeInteger(archetype.femaleProbabilityMillionth) || archetype.femaleProbabilityMillionth < 0 || archetype.femaleProbabilityMillionth > 1_000_000 ||
    archetype.adultAgeRange.minimumYears < 18 || archetype.adultAgeRange.maximumYears < archetype.adultAgeRange.minimumYears ||
    archetype.childAgeRange.minimumYears < 0 || archetype.childAgeRange.maximumYears > 17 || archetype.childAgeRange.maximumYears < archetype.childAgeRange.minimumYears
  ) {
    throw new RciContractError('rci:unknown-definition');
  }
  return Object.freeze({
    ...archetype,
    adultAgeRange: Object.freeze({ ...archetype.adultAgeRange }),
    childAgeRange: Object.freeze({ ...archetype.childAgeRange }),
  });
}

export function createFoundationRciRegistries(
  extensions: RciDefinitionExtensions = {},
): RciDefinitionRegistries {
  const sexes = createDefinitionRegistry(combined(FOUNDATION_SEXES, extensions.sexes));
  const relationshipTypes = createDefinitionRegistry(combined(FOUNDATION_RELATIONSHIP_TYPES, extensions.relationshipTypes));
  const qualifications = createDefinitionRegistry(combined(FOUNDATION_QUALIFICATIONS, extensions.qualifications));
  for (const qualification of qualifications.values()) {
    if (!Number.isSafeInteger(qualification.rank) || qualification.rank < 0) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  const employmentRequirements = createDefinitionRegistry(combined(FOUNDATION_EMPLOYMENT_REQUIREMENTS, extensions.employmentRequirements));
  for (const requirement of employmentRequirements.values()) {
    if (!qualifications.has(requirement.minimumQualificationDefinitionId)) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  const occupations = createDefinitionRegistry(extensions.occupations ?? []);
  const positionGroups = createDefinitionRegistry(combined(FOUNDATION_POSITION_GROUPS, extensions.positionGroups));
  for (const group of positionGroups.values()) {
    if (!employmentRequirements.has(group.employmentRequirementDefinitionId) ||
        (group.occupationDefinitionId !== null && !occupations.has(group.occupationDefinitionId))) {
      throw new RciContractError('rci:unknown-definition');
    }
  }

  const capacityProfiles = createDefinitionRegistry(
    combined(FOUNDATION_CAPACITY_PROFILES, extensions.capacityProfiles).map(freezeCapacityProfile),
  );
  for (const profile of capacityProfiles.values()) {
    if (profile.kind === 'residential') continue;
    for (const group of profile.positionGroups) {
      if (!positionGroups.has(group.positionGroupDefinitionId) ||
          !employmentRequirements.has(group.employmentRequirementDefinitionId) ||
          (group.occupationDefinitionId !== null && !occupations.has(group.occupationDefinitionId))) {
        throw new RciContractError('rci:unknown-definition');
      }
    }
  }

  const migrationArchetypes = createDefinitionRegistry(
    combined(FOUNDATION_MIGRATION_ARCHETYPES, extensions.migrationArchetypes).map(freezeMigrationArchetype),
  );
  const populationRateProfiles = createDefinitionRegistry(
    combined([FOUNDATION_POPULATION_RATE_PROFILE], extensions.populationRateProfiles?.map(freezeRateProfile)),
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
    migrationArchetypes,
    capacityProfiles,
    demandFactors: createDefinitionRegistry(extensions.demandFactors ?? []),
    populationRateProfiles,
  });
}
