import type { CitizenId } from '../contracts/ids.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { deterministicSample, type ProbabilityUnit } from './deterministic-sample.js';

export type QualificationResolverContext =
  'working-age-immigrant' | 'resident-reaching-working-age';

export interface QualificationResolver {
  resolve(
    input: Readonly<{
      citizenId: CitizenId;
      context: QualificationResolverContext;
      evaluationTick: number;
      deterministicSeed: number;
    }>,
  ): string;
}

export interface QualificationResolverOptions {
  readonly sample?: (
    input: Readonly<{
      citizenId: CitizenId;
      context: QualificationResolverContext;
      evaluationTick: number;
      deterministicSeed: number;
    }>,
  ) => ProbabilityUnit;
}

export function createFoundationQualificationResolver(
  registries: RciDefinitionRegistries,
  options: QualificationResolverOptions = {},
): QualificationResolver {
  const sampleFor =
    options.sample ??
    ((input) =>
      deterministicSample({
        seed: input.deterministicSeed,
        eventType: `qualification:${input.context}`,
        evaluationTick: input.evaluationTick,
        entityStableId: input.citizenId,
        attemptIndex: 0,
      }));

  return Object.freeze({
    resolve(input): string {
      const sample = sampleFor(input);
      const immigrant = input.context === 'working-age-immigrant';
      const entryThreshold = immigrant ? 550_000_000 : 700_000_000;
      const skilledThreshold = immigrant ? 870_000_000 : 950_000_000;
      const id =
        sample < entryThreshold
          ? 'qualification.entry'
          : sample < skilledThreshold
            ? 'qualification.skilled'
            : 'qualification.professional';
      return registries.qualifications.get(id).id;
    },
  });
}
