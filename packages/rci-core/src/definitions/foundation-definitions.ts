import { RciContractError } from '../contracts/errors.js';
import type {
  EmploymentRequirementDefinition,
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

function combined<T>(foundation: readonly T[], extensions: readonly T[] | undefined): readonly T[] {
  return Object.freeze([...foundation, ...(extensions ?? [])]);
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
    populationRateProfiles: createDefinitionRegistry(extensions.populationRateProfiles ?? []),
  });
}
