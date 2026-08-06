import {
  invalidRecordMutationPlan,
  validRecordMutationPlan,
  type RciRecordMutationPlan,
} from '../contracts/mutation-plan.js';
import type { CitizenId } from '../contracts/ids.js';
import type { CitizenQualificationRecord } from '../contracts/records.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function planAwardCitizenQualification(input: Readonly<{
  snapshot: RciSnapshot;
  citizenId: CitizenId;
  qualificationDefinitionId: string;
  awardedAtTick: number;
  sourceDefinitionId: string;
  registries: RciDefinitionRegistries;
}>): RciRecordMutationPlan {
  const { snapshot } = input;
  const citizen = snapshot.population.citizens.find(
    (candidate) => candidate.citizenId === input.citizenId,
  );
  const hasActive = snapshot.population.qualifications.some(
    (qualification) =>
      qualification.citizenId === input.citizenId && qualification.endedAtTick === null,
  );
  if (
    citizen === undefined ||
    citizen.presence !== 'resident' ||
    hasActive ||
    !input.registries.qualifications.has(input.qualificationDefinitionId) ||
    input.sourceDefinitionId.length === 0 ||
    !Number.isSafeInteger(input.awardedAtTick) ||
    input.awardedAtTick < 0
  ) {
    return invalidRecordMutationPlan(snapshot, 'rci:invalid-state');
  }

  const qualification: CitizenQualificationRecord = Object.freeze({
    citizenQualificationId: `citizen-qualification:${snapshot.sequences.nextCitizenQualification}`,
    citizenId: input.citizenId,
    qualificationDefinitionId: input.qualificationDefinitionId,
    awardedAtTick: input.awardedAtTick,
    endedAtTick: null,
    sourceDefinitionId: input.sourceDefinitionId,
  });
  const proposed = canonicalizeRciSnapshot({
    ...snapshot,
    revision: snapshot.revision + 1,
    population: {
      revision: snapshot.population.revision + 1,
      citizens: snapshot.population.citizens,
      qualifications: [...snapshot.population.qualifications, qualification],
    },
    sequences: {
      ...snapshot.sequences,
      nextCitizenQualification: snapshot.sequences.nextCitizenQualification + 1,
    },
  });
  return validRecordMutationPlan(snapshot, proposed);
}
