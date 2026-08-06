import { compareStableId } from '../contracts/ids.js';
import type {
  CitizenQualificationRecord,
  CitizenRecord,
  HouseholdMembershipRecord,
  HouseholdRecord,
  RelationshipRecord,
} from '../contracts/records.js';
import type {
  AnnualRateBandDefinition,
  PopulationRateProfileDefinition,
  RciDefinitionRegistries,
} from '../definitions/contracts.js';
import type { RciDomainEvent } from '../events/rci-domain-event.js';
import { orderRciDomainEvents } from '../events/event-ordering.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';
import { ageBandAtTick, ageYearsAtTick } from './age.js';
import { deterministicSample, PROBABILITY_SCALE } from './deterministic-sample.js';
import { compileAnnualRateToDailyHazard, sampleSucceeds } from './hazard.js';
import {
  createFoundationQualificationResolver,
  type QualificationResolver,
} from './qualification-resolver.js';

export interface PopulationLifecycleResult {
  readonly snapshot: RciSnapshot;
  readonly events: readonly RciDomainEvent[];
}

function annualRateForAge(
  bands: readonly AnnualRateBandDefinition[],
  age: number,
): number {
  return (
    bands.find((band) => age >= band.minAge && (band.maxAge === null || age <= band.maxAge))
      ?.annualRateMillionth ?? 0
  );
}

function activeMembershipFor(
  memberships: readonly HouseholdMembershipRecord[],
  citizenId: string,
): HouseholdMembershipRecord | undefined {
  return memberships.find(
    (membership) => membership.citizenId === citizenId && membership.endedAtTick === null,
  );
}

function activePartnerFor(
  relationships: readonly RelationshipRecord[],
  citizenId: string,
): string | null {
  const relationship = relationships.find(
    (candidate) =>
      candidate.orientation === 'undirected' &&
      candidate.typeDefinitionId === 'relationship.partner' &&
      candidate.endedAtTick === null &&
      candidate.participantCitizenIds.includes(citizenId),
  );
  if (relationship === undefined || relationship.orientation !== 'undirected') return null;
  return relationship.participantCitizenIds.find((participant) => participant !== citizenId) ?? null;
}

function eventBase(
  type: RciDomainEvent['type'],
  tick: number,
  priority: number,
  entityKind: RciDomainEvent['entityKind'],
  entityId: string,
  sequence: number,
) {
  return { type, tick, priority, entityKind, entityId, sequence } as const;
}

export function evaluateDailyPopulationLifecycle(input: Readonly<{
  snapshot: RciSnapshot;
  evaluationTick: number;
  registries: RciDefinitionRegistries;
  populationRateProfile: PopulationRateProfileDefinition;
  qualificationResolver?: QualificationResolver;
}>): PopulationLifecycleResult {
  const base = canonicalizeRciSnapshot(input.snapshot);
  const originalResidents = base.population.citizens
    .filter((citizen) => citizen.presence === 'resident')
    .sort((first, second) => compareStableId(first.citizenId, second.citizenId));
  let citizens: CitizenRecord[] = [...base.population.citizens];
  let qualifications: CitizenQualificationRecord[] = [...base.population.qualifications];
  let relationships: RelationshipRecord[] = [...base.relationships.relationships];
  let households: HouseholdRecord[] = [...base.households.households];
  let memberships: HouseholdMembershipRecord[] = [...base.households.memberships];
  const events: RciDomainEvent[] = [];
  let nextCitizen = base.sequences.nextCitizen;
  let nextMembership = base.sequences.nextHouseholdMembership;
  let nextRelationship = base.sequences.nextRelationship;
  let nextQualification = base.sequences.nextCitizenQualification;
  let nextEvent = base.sequences.nextDomainEvent;
  let populationChanged = false;
  let relationshipChanged = false;
  let householdChanged = false;
  const resolver =
    input.qualificationResolver ?? createFoundationQualificationResolver(input.registries);

  for (const citizen of originalResidents) {
    const beforeBand = ageBandAtTick(citizen.bornAtTick, input.evaluationTick - 1);
    const afterBand = ageBandAtTick(citizen.bornAtTick, input.evaluationTick);
    if (beforeBand === afterBand) continue;
    events.push(
      Object.freeze({
        ...eventBase(
          'citizen.reached-age-band',
          input.evaluationTick,
          10,
          'citizen',
          citizen.citizenId,
          nextEvent,
        ),
        ageBandDefinitionId: afterBand,
      }),
    );
    nextEvent += 1;
    if (
      afterBand === 'age-band.working-age' &&
      !qualifications.some(
        (qualification) =>
          qualification.citizenId === citizen.citizenId && qualification.endedAtTick === null,
      )
    ) {
      const qualificationDefinitionId = resolver.resolve({
        citizenId: citizen.citizenId,
        context: 'resident-reaching-working-age',
        evaluationTick: input.evaluationTick,
        deterministicSeed: base.deterministicSeed,
      });
      const qualification: CitizenQualificationRecord = Object.freeze({
        citizenQualificationId: `citizen-qualification:${nextQualification}`,
        citizenId: citizen.citizenId,
        qualificationDefinitionId,
        awardedAtTick: input.evaluationTick,
        endedAtTick: null,
        sourceDefinitionId: 'qualification-source.reached-working-age.v1',
      });
      qualifications.push(qualification);
      events.push(
        Object.freeze({
          ...eventBase(
            'qualification.awarded',
            input.evaluationTick,
            20,
            'qualification',
            qualification.citizenQualificationId,
            nextEvent,
          ),
        }),
      );
      nextQualification += 1;
      nextEvent += 1;
      populationChanged = true;
    }
  }

  for (const mother of originalResidents) {
    if (!input.populationRateProfile.fertilityEligibleSexDefinitionIds.includes(mother.sexDefinitionId)) {
      continue;
    }
    const membership = activeMembershipFor(memberships, mother.citizenId);
    if (membership === undefined) continue;
    const age = ageYearsAtTick(mother.bornAtTick, input.evaluationTick);
    const hazard = compileAnnualRateToDailyHazard(
      annualRateForAge(input.populationRateProfile.fertilityBands, age),
    );
    const sample = deterministicSample({
      seed: base.deterministicSeed,
      eventType: 'fertility',
      evaluationTick: input.evaluationTick,
      entityStableId: mother.citizenId,
      attemptIndex: 0,
    });
    if (!sampleSucceeds(sample, hazard)) continue;

    const childId = `citizen:${nextCitizen}`;
    const sexSample = deterministicSample({
      seed: base.deterministicSeed,
      eventType: 'birth-sex',
      evaluationTick: input.evaluationTick,
      entityStableId: childId,
      attemptIndex: 0,
    });
    const child: CitizenRecord = Object.freeze({
      citizenId: childId,
      presence: 'resident',
      sexDefinitionId: sexSample < PROBABILITY_SCALE / 2 ? 'sex.female' : 'sex.male',
      bornAtTick: input.evaluationTick,
      movedIntoCityAtTick: input.evaluationTick,
      movedOutOfCityAtTick: null,
      diedAtTick: null,
    });
    citizens.push(child);
    memberships.push(
      Object.freeze({
        membershipId: `household-membership:${nextMembership}`,
        householdId: membership.householdId,
        citizenId: childId,
        startedAtTick: input.evaluationTick,
        endedAtTick: null,
        endReasonDefinitionId: null,
      }),
    );
    relationships.push(
      Object.freeze({
        relationshipId: `relationship:${nextRelationship}`,
        orientation: 'directional',
        typeDefinitionId: 'relationship.parent.biological.mother',
        sourceCitizenId: mother.citizenId,
        targetCitizenId: childId,
        startedAtTick: input.evaluationTick,
        endedAtTick: null,
      }),
    );
    nextRelationship += 1;
    const partnerId = activePartnerFor(relationships, mother.citizenId);
    const partner = citizens.find((citizen) => citizen.citizenId === partnerId);
    if (partner?.presence === 'resident' && partner.sexDefinitionId === 'sex.male') {
      relationships.push(
        Object.freeze({
          relationshipId: `relationship:${nextRelationship}`,
          orientation: 'directional',
          typeDefinitionId: 'relationship.parent.biological.father',
          sourceCitizenId: partner.citizenId,
          targetCitizenId: childId,
          startedAtTick: input.evaluationTick,
          endedAtTick: null,
        }),
      );
      nextRelationship += 1;
    }
    events.push(
      Object.freeze({
        ...eventBase(
          'citizen.born',
          input.evaluationTick,
          30,
          'citizen',
          childId,
          nextEvent,
        ),
      }),
    );
    nextCitizen += 1;
    nextMembership += 1;
    nextEvent += 1;
    populationChanged = true;
    relationshipChanged = true;
    householdChanged = true;
  }

  for (const citizen of originalResidents) {
    const age = ageYearsAtTick(citizen.bornAtTick, input.evaluationTick);
    const hazard = compileAnnualRateToDailyHazard(
      annualRateForAge(input.populationRateProfile.mortalityBands, age),
    );
    const sample = deterministicSample({
      seed: base.deterministicSeed,
      eventType: 'mortality',
      evaluationTick: input.evaluationTick,
      entityStableId: citizen.citizenId,
      attemptIndex: 0,
    });
    if (!sampleSucceeds(sample, hazard)) continue;

    citizens = citizens.map((candidate) =>
      candidate.citizenId === citizen.citizenId
        ? Object.freeze({
            ...candidate,
            presence: 'deceased' as const,
            diedAtTick: input.evaluationTick,
          })
        : candidate,
    );
    memberships = memberships.map((membership) =>
      membership.citizenId === citizen.citizenId && membership.endedAtTick === null
        ? Object.freeze({
            ...membership,
            endedAtTick: input.evaluationTick,
            endReasonDefinitionId: 'household-membership-ended.citizen-deceased',
          })
        : membership,
    );
    qualifications = qualifications.map((qualification) =>
      qualification.citizenId === citizen.citizenId && qualification.endedAtTick === null
        ? Object.freeze({ ...qualification, endedAtTick: input.evaluationTick })
        : qualification,
    );
    relationships = relationships.map((relationship) =>
      relationship.orientation === 'undirected' &&
      relationship.typeDefinitionId === 'relationship.partner' &&
      relationship.endedAtTick === null &&
      relationship.participantCitizenIds.includes(citizen.citizenId)
        ? Object.freeze({ ...relationship, endedAtTick: input.evaluationTick })
        : relationship,
    );
    events.push(
      Object.freeze({
        ...eventBase(
          'citizen.died',
          input.evaluationTick,
          40,
          'citizen',
          citizen.citizenId,
          nextEvent,
        ),
      }),
    );
    nextEvent += 1;
    populationChanged = true;
    householdChanged = true;
    relationshipChanged = true;
  }

  const activeHouseholdIds = new Set(
    memberships
      .filter((membership) => membership.endedAtTick === null)
      .map((membership) => membership.householdId),
  );
  households = households.map((household) => {
    if (household.dissolvedAtTick !== null || activeHouseholdIds.has(household.householdId)) {
      return household;
    }
    events.push(
      Object.freeze({
        ...eventBase(
          'household.dissolved',
          input.evaluationTick,
          60,
          'household',
          household.householdId,
          nextEvent,
        ),
      }),
    );
    nextEvent += 1;
    householdChanged = true;
    return Object.freeze({ ...household, dissolvedAtTick: input.evaluationTick });
  });

  const changed = populationChanged || relationshipChanged || householdChanged;
  if (!changed && events.length === 0) {
    return Object.freeze({ snapshot: base, events: Object.freeze([]) });
  }
  const snapshot = canonicalizeRciSnapshot({
    ...base,
    revision: base.revision + 1,
    population: {
      revision: base.population.revision + (populationChanged ? 1 : 0),
      citizens,
      qualifications,
    },
    relationships: {
      revision: base.relationships.revision + (relationshipChanged ? 1 : 0),
      relationships,
    },
    households: {
      revision: base.households.revision + (householdChanged ? 1 : 0),
      households,
      memberships,
    },
    sequences: {
      ...base.sequences,
      nextCitizen,
      nextHouseholdMembership: nextMembership,
      nextRelationship,
      nextCitizenQualification: nextQualification,
      nextDomainEvent: nextEvent,
    },
  });
  return Object.freeze({ snapshot, events: orderRciDomainEvents(events) });
}
