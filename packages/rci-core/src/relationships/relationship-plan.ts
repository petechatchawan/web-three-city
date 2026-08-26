import {
  compareMacroHours,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import {
  invalidRecordMutationPlan,
  validRecordMutationPlan,
  type RciRecordMutationPlan,
} from '../contracts/mutation-plan.js';
import { canonicalCitizenPair, compareStableId, type CitizenId } from '../contracts/ids.js';
import type {
  DirectionalRelationshipRecord,
  RelationshipRecord,
  UndirectedRelationshipRecord,
} from '../contracts/records.js';
import { compareAgeOrigins } from '../population/age.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

function citizenFor(snapshot: RciSnapshot, citizenId: CitizenId) {
  return snapshot.population.citizens.find((citizen) => citizen.citizenId === citizenId);
}

function nextRelationshipId(snapshot: RciSnapshot): string {
  return `relationship:${snapshot.sequences.nextRelationship}`;
}

function appendRelationship(
  snapshot: RciSnapshot,
  relationship: RelationshipRecord,
): RciRecordMutationPlan {
  const proposed = canonicalizeRciSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    relationships: {
      revision: snapshot.relationships.revision + 1,
      relationships: [...snapshot.relationships.relationships, relationship],
    },
    sequences: {
      ...snapshot.sequences,
      nextRelationship: snapshot.sequences.nextRelationship + 1,
    },
  });
  return validRecordMutationPlan(snapshot, proposed);
}

export function planCreatePartnerRelationship(
  input: Readonly<{
    snapshot: RciSnapshot;
    firstCitizenId: CitizenId;
    secondCitizenId: CitizenId;
    startedAtMacroHourIndex: MacroHourIndex;
  }>,
): RciRecordMutationPlan {
  const { snapshot } = input;
  const first = citizenFor(snapshot, input.firstCitizenId);
  const second = citizenFor(snapshot, input.secondCitizenId);
  if (
    first === undefined ||
    second === undefined ||
    first.presence !== 'resident' ||
    second.presence !== 'resident' ||
    !Number.isSafeInteger(macroHourValue(input.startedAtMacroHourIndex)) ||
    macroHourValue(input.startedAtMacroHourIndex) < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-relationship');
  }

  let participants: readonly [CitizenId, CitizenId];
  try {
    participants = canonicalCitizenPair(input.firstCitizenId, input.secondCitizenId);
  } catch {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-relationship');
  }
  const hasActivePartner = snapshot.relationships.relationships.some(
    (relationship) =>
      relationship.orientation === 'undirected' &&
      relationship.typeDefinitionId === 'relationship.partner' &&
      relationship.endedAtMacroHourIndex === null &&
      relationship.participantCitizenIds.some(
        (citizenId) => citizenId === participants[0] || citizenId === participants[1],
      ),
  );
  if (hasActivePartner) {
    return invalidRecordMutationPlan(snapshot, 'rci:duplicate-active-partner');
  }

  const relationship: UndirectedRelationshipRecord = Object.freeze({
    relationshipId: nextRelationshipId(snapshot),
    orientation: 'undirected',
    typeDefinitionId: 'relationship.partner',
    participantCitizenIds: participants,
    startedAtMacroHourIndex: input.startedAtMacroHourIndex,
    endedAtMacroHourIndex: null,
  });
  return appendRelationship(snapshot, relationship);
}

export function planEndPartnerRelationship(
  input: Readonly<{
    snapshot: RciSnapshot;
    citizenId: CitizenId;
    endedAtMacroHourIndex: MacroHourIndex;
  }>,
): RciRecordMutationPlan {
  const { snapshot } = input;
  const target = snapshot.relationships.relationships.find(
    (relationship) =>
      relationship.orientation === 'undirected' &&
      relationship.typeDefinitionId === 'relationship.partner' &&
      relationship.endedAtMacroHourIndex === null &&
      relationship.participantCitizenIds.includes(input.citizenId),
  );
  if (
    target === undefined ||
    !Number.isSafeInteger(macroHourValue(input.endedAtMacroHourIndex)) ||
    compareMacroHours(input.endedAtMacroHourIndex, target.startedAtMacroHourIndex) < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-relationship');
  }

  const relationships = snapshot.relationships.relationships.map((relationship) =>
    relationship.relationshipId === target.relationshipId
      ? Object.freeze({ ...relationship, endedAtMacroHourIndex: input.endedAtMacroHourIndex })
      : relationship,
  );
  const proposed = canonicalizeRciSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    relationships: {
      revision: snapshot.relationships.revision + 1,
      relationships,
    },
  });
  return validRecordMutationPlan(snapshot, proposed);
}

export function planCreateDirectionalRelationship(
  input: Readonly<{
    snapshot: RciSnapshot;
    typeDefinitionId: string;
    sourceCitizenId: CitizenId;
    targetCitizenId: CitizenId;
    startedAtMacroHourIndex: MacroHourIndex;
  }>,
): RciRecordMutationPlan {
  const { snapshot } = input;
  const source = citizenFor(snapshot, input.sourceCitizenId);
  const target = citizenFor(snapshot, input.targetCitizenId);
  const isBiologicalParent =
    input.typeDefinitionId === 'relationship.parent.biological.mother' ||
    input.typeDefinitionId === 'relationship.parent.biological.father';
  if (
    !isBiologicalParent ||
    source === undefined ||
    target === undefined ||
    source.citizenId === target.citizenId ||
    compareStableId(source.citizenId, target.citizenId) === 0 ||
    compareAgeOrigins(source.bornAtMacroHourIndex, target.bornAtMacroHourIndex) >= 0 ||
    !Number.isSafeInteger(macroHourValue(input.startedAtMacroHourIndex)) ||
    macroHourValue(input.startedAtMacroHourIndex) < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-relationship');
  }
  const duplicate = snapshot.relationships.relationships.some(
    (relationship) =>
      relationship.orientation === 'directional' &&
      relationship.typeDefinitionId === input.typeDefinitionId &&
      relationship.targetCitizenId === input.targetCitizenId,
  );
  if (duplicate) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-relationship');
  }

  const relationship: DirectionalRelationshipRecord = Object.freeze({
    relationshipId: nextRelationshipId(snapshot),
    orientation: 'directional',
    typeDefinitionId: input.typeDefinitionId,
    sourceCitizenId: input.sourceCitizenId,
    targetCitizenId: input.targetCitizenId,
    startedAtMacroHourIndex: input.startedAtMacroHourIndex,
    endedAtMacroHourIndex: null,
  });
  return appendRelationship(snapshot, relationship);
}
