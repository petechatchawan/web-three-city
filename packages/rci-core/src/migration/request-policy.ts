import type { MacroHourIndex } from '@web-three-city/simulation-core';
import type { IncomingHouseholdRequest } from '../contracts/records.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { deterministicSample } from '../population/deterministic-sample.js';
import type { RciConfiguration } from '../rci-configuration.js';
import type { RciSnapshot } from '../rci-snapshot.js';

export interface MigrationRequestPolicy {
  planRequests(
    input: Readonly<{
      snapshot: RciSnapshot;
      evaluationMacroHourIndex: MacroHourIndex;
      suitableVacantJobCount: number;
      registries: RciDefinitionRegistries;
      configuration: RciConfiguration;
    }>,
  ): Readonly<{
    requests: readonly IncomingHouseholdRequest[];
    nextAttractionMilli: number;
    nextIncomingRequestSequence: number;
  }>;
}

export function createFoundationMigrationRequestPolicy(): MigrationRequestPolicy {
  return Object.freeze({
    planRequests(input: Parameters<MigrationRequestPolicy['planRequests']>[0]) {
      const queueRoom = Math.max(
        0,
        (input.configuration.incomingQueueCapacity ?? 64) -
          input.snapshot.migration.incomingRequests.length,
      );
      const contribution = Math.min(
        650,
        Math.max(0, input.suitableVacantJobCount) *
          (input.configuration.incomingVacantJobContributionMilli ?? 50),
      );
      let attraction =
        input.snapshot.migration.attractionMilli +
        (input.configuration.incomingBaselineMilli ?? 350) +
        contribution;
      const requested = Math.min(
        input.configuration.maxIncomingRequestsPerDay ?? 2,
        queueRoom,
        Math.floor(attraction / 1_000),
      );
      if (requested === 0) {
        return Object.freeze({
          requests: Object.freeze([]),
          nextAttractionMilli: attraction,
          nextIncomingRequestSequence: input.snapshot.sequences.nextIncomingRequest,
        });
      }
      const archetypes = input.registries.migrationArchetypes.values();
      if (archetypes.length === 0) {
        return Object.freeze({
          requests: Object.freeze([]),
          nextAttractionMilli: attraction,
          nextIncomingRequestSequence: input.snapshot.sequences.nextIncomingRequest,
        });
      }
      const requests: IncomingHouseholdRequest[] = [];
      let nextSequence = input.snapshot.sequences.nextIncomingRequest;
      const totalWeight = archetypes.reduce((sum, archetype) => sum + archetype.weight, 0);
      for (let index = 0; index < requested; index += 1) {
        const sample = deterministicSample({
          seed: input.snapshot.deterministicSeed,
          eventType: 'migration-request-archetype',
          evaluationMacroHourIndex: input.evaluationMacroHourIndex,
          entityStableId: `incoming-household:${nextSequence}`,
          attemptIndex: index,
        });
        let cursor = totalWeight === 0 ? 0 : sample % totalWeight;
        let selected = archetypes[0]!;
        for (const archetype of archetypes) {
          if (cursor < archetype.weight) {
            selected = archetype;
            break;
          }
          cursor -= archetype.weight;
        }
        requests.push(
          Object.freeze({
            requestId: `incoming-household:${nextSequence}`,
            archetypeDefinitionId: selected.id,
            requestedAtMacroHourIndex: input.evaluationMacroHourIndex,
            minimumResidentCapacity: selected.minimumResidentCapacity,
            queuePriority: 0,
            deterministicSequence: nextSequence,
          }),
        );
        nextSequence += 1;
        attraction -= 1_000;
      }
      return Object.freeze({
        requests: Object.freeze(requests),
        nextAttractionMilli: attraction,
        nextIncomingRequestSequence: nextSequence,
      });
    },
  });
}
