import { type MacroHourIndex } from '@web-three-city/simulation-core';
import { RciContractError } from '../contracts/errors.js';
import { compareStableId } from '../contracts/ids.js';
import type { DwellingUnitId, IncomingHouseholdRequestId } from '../contracts/ids.js';
import type {
  CitizenRecord,
  HouseholdMembershipRecord,
  RelationshipRecord,
} from '../contracts/records.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { residentialCapacityProfileForId } from '../housing/capacity-profile.js';
import { ageOriginForYearsAtMacroHour } from '../population/age.js';
import { deterministicSample, PROBABILITY_SCALE } from '../population/deterministic-sample.js';
import type { QualificationResolver } from '../population/qualification-resolver.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

function sampleAge(
  input: Readonly<{
    seed: number;
    requestId: string;
    evaluationMacroHourIndex: MacroHourIndex;
    attemptIndex: number;
    minimumYears: number;
    maximumYears: number;
    namespace: string;
  }>,
): number {
  const span = input.maximumYears - input.minimumYears + 1;
  return (
    input.minimumYears +
    (deterministicSample({
      seed: input.seed,
      eventType: input.namespace,
      evaluationMacroHourIndex: input.evaluationMacroHourIndex,
      entityStableId: input.requestId,
      attemptIndex: input.attemptIndex,
    }) %
      span)
  );
}

export function planMaterializeIncomingHousehold(
  input: Readonly<{
    snapshot: RciSnapshot;
    requestId: IncomingHouseholdRequestId;
    dwellingUnitId: DwellingUnitId;
    evaluationMacroHourIndex: MacroHourIndex;
    registries: RciDefinitionRegistries;
    qualificationResolver: QualificationResolver;
  }>,
): RciSnapshot {
  const request = input.snapshot.migration.incomingRequests.find(
    (value) => value.requestId === input.requestId,
  );
  const unit = input.snapshot.housing.dwellingUnits.find(
    (value) => value.dwellingUnitId === input.dwellingUnitId,
  );
  if (request === undefined || unit === undefined || unit.retiredAtMacroHourIndex !== null) {
    throw new RciContractError('rci:invalid-state');
  }
  if (
    input.snapshot.housing.assignments.some(
      (assignment) =>
        assignment.dwellingUnitId === unit.dwellingUnitId &&
        assignment.endedAtMacroHourIndex === null,
    )
  ) {
    throw new RciContractError('rci:duplicate-active-housing');
  }
  const profile = residentialCapacityProfileForId(
    input.registries.capacityProfiles,
    unit.capacityProfileDefinitionId,
  );
  const archetype = input.registries.migrationArchetypes.get(request.archetypeDefinitionId);
  if (
    archetype.memberCount > profile.residentCapacityPerUnit ||
    archetype.minimumResidentCapacity > profile.residentCapacityPerUnit
  ) {
    throw new RciContractError('rci:capacity-exceeded');
  }

  let nextCitizen = input.snapshot.sequences.nextCitizen;
  let nextMembership = input.snapshot.sequences.nextHouseholdMembership;
  let nextRelationship = input.snapshot.sequences.nextRelationship;
  let nextQualification = input.snapshot.sequences.nextCitizenQualification;
  const householdId = `household:${input.snapshot.sequences.nextHousehold}`;
  const citizens: CitizenRecord[] = [];
  const memberships: HouseholdMembershipRecord[] = [];
  const relationships: RelationshipRecord[] = [];
  const qualifications = [...input.snapshot.population.qualifications];
  const adultIds: string[] = [];

  for (let index = 0; index < archetype.memberCount; index += 1) {
    const citizenId = `citizen:${nextCitizen}`;
    const adult = index < archetype.adultCount;
    const ageRange = adult ? archetype.adultAgeRange : archetype.childAgeRange;
    const age = sampleAge({
      seed: input.snapshot.deterministicSeed,
      requestId: request.requestId,
      evaluationMacroHourIndex: input.evaluationMacroHourIndex,
      attemptIndex: index,
      minimumYears: ageRange.minimumYears,
      maximumYears: ageRange.maximumYears,
      namespace: adult ? 'migration-age-adult' : 'migration-age-child',
    });
    const sexSample = deterministicSample({
      seed: input.snapshot.deterministicSeed,
      eventType: 'migration-sex',
      evaluationMacroHourIndex: input.evaluationMacroHourIndex,
      entityStableId: citizenId,
      attemptIndex: index,
    });
    let sexDefinitionId =
      sexSample < Math.round((PROBABILITY_SCALE * archetype.femaleProbabilityMillionth) / 1_000_000)
        ? 'sex.female'
        : 'sex.male';
    if (archetype.partneredAdults && index === 0) sexDefinitionId = 'sex.female';
    if (archetype.partneredAdults && index === 1) sexDefinitionId = 'sex.male';

    citizens.push(
      Object.freeze({
        citizenId,
        presence: 'resident',
        sexDefinitionId,
        bornAtMacroHourIndex: ageOriginForYearsAtMacroHour(input.evaluationMacroHourIndex, age),
        movedIntoCityAtMacroHourIndex: input.evaluationMacroHourIndex,
        movedOutOfCityAtMacroHourIndex: null,
        diedAtMacroHourIndex: null,
      }),
    );
    memberships.push(
      Object.freeze({
        membershipId: `household-membership:${nextMembership}`,
        householdId,
        citizenId,
        startedAtMacroHourIndex: input.evaluationMacroHourIndex,
        endedAtMacroHourIndex: null,
        endReasonDefinitionId: null,
      }),
    );
    if (adult) {
      adultIds.push(citizenId);
      const qualificationDefinitionId = input.qualificationResolver.resolve({
        citizenId,
        context: 'working-age-immigrant',
        evaluationMacroHourIndex: input.evaluationMacroHourIndex,
        deterministicSeed: input.snapshot.deterministicSeed,
      });
      qualifications.push(
        Object.freeze({
          citizenQualificationId: `citizen-qualification:${nextQualification}`,
          citizenId,
          qualificationDefinitionId,
          awardedAtMacroHourIndex: input.evaluationMacroHourIndex,
          endedAtMacroHourIndex: null,
          sourceDefinitionId: 'qualification-source.migration-archetype.v1',
        }),
      );
      nextQualification += 1;
    }
    nextCitizen += 1;
    nextMembership += 1;
  }

  if (archetype.partneredAdults && adultIds.length >= 2) {
    const pair = [...adultIds.slice(0, 2)].sort(compareStableId) as [string, string];
    relationships.push(
      Object.freeze({
        relationshipId: `relationship:${nextRelationship}`,
        orientation: 'undirected',
        typeDefinitionId: 'relationship.partner',
        participantCitizenIds: pair,
        startedAtMacroHourIndex: input.evaluationMacroHourIndex,
        endedAtMacroHourIndex: null,
      }),
    );
    nextRelationship += 1;
  }

  const adultCitizens = citizens.slice(0, archetype.adultCount);
  const motherId =
    adultCitizens.find((citizen) => citizen.sexDefinitionId === 'sex.female')?.citizenId ??
    adultCitizens[0]?.citizenId;
  const fatherId = adultCitizens.find(
    (citizen) => citizen.sexDefinitionId === 'sex.male' && citizen.citizenId !== motherId,
  )?.citizenId;
  for (let childIndex = archetype.adultCount; childIndex < citizens.length; childIndex += 1) {
    const childId = citizens[childIndex]!.citizenId;
    if (motherId !== undefined) {
      relationships.push(
        Object.freeze({
          relationshipId: `relationship:${nextRelationship}`,
          orientation: 'directional',
          typeDefinitionId: 'relationship.parent.biological.mother',
          sourceCitizenId: motherId,
          targetCitizenId: childId,
          startedAtMacroHourIndex: input.evaluationMacroHourIndex,
          endedAtMacroHourIndex: null,
        }),
      );
      nextRelationship += 1;
    }
    if (fatherId !== undefined) {
      relationships.push(
        Object.freeze({
          relationshipId: `relationship:${nextRelationship}`,
          orientation: 'directional',
          typeDefinitionId: 'relationship.parent.biological.father',
          sourceCitizenId: fatherId,
          targetCitizenId: childId,
          startedAtMacroHourIndex: input.evaluationMacroHourIndex,
          endedAtMacroHourIndex: null,
        }),
      );
      nextRelationship += 1;
    }
  }

  return canonicalizeRciSnapshot({
    ...input.snapshot,
    revision: input.snapshot.revision + 1,
    population: {
      revision: input.snapshot.population.revision + 1,
      citizens: [...input.snapshot.population.citizens, ...citizens],
      qualifications,
    },
    relationships: {
      revision: input.snapshot.relationships.revision + (relationships.length > 0 ? 1 : 0),
      relationships: [...input.snapshot.relationships.relationships, ...relationships],
    },
    households: {
      revision: input.snapshot.households.revision + 1,
      households: [
        ...input.snapshot.households.households,
        Object.freeze({
          householdId,
          foundedAtMacroHourIndex: input.evaluationMacroHourIndex,
          dissolvedAtMacroHourIndex: null,
        }),
      ],
      memberships: [...input.snapshot.households.memberships, ...memberships],
    },
    housing: {
      ...input.snapshot.housing,
      revision: input.snapshot.housing.revision + 1,
      assignments: [
        ...input.snapshot.housing.assignments,
        Object.freeze({
          housingAssignmentId: `housing-assignment:${input.snapshot.sequences.nextHousingAssignment}`,
          householdId,
          dwellingUnitId: input.dwellingUnitId,
          startedAtMacroHourIndex: input.evaluationMacroHourIndex,
          endedAtMacroHourIndex: null,
          endReasonDefinitionId: null,
        }),
      ],
    },
    migration: {
      ...input.snapshot.migration,
      revision: input.snapshot.migration.revision + 1,
      incomingRequests: input.snapshot.migration.incomingRequests.filter(
        (value) => value.requestId !== input.requestId,
      ),
    },
    sequences: {
      ...input.snapshot.sequences,
      nextCitizen,
      nextHousehold: input.snapshot.sequences.nextHousehold + 1,
      nextHouseholdMembership: nextMembership,
      nextRelationship,
      nextCitizenQualification: nextQualification,
      nextHousingAssignment: input.snapshot.sequences.nextHousingAssignment + 1,
    },
  });
}
