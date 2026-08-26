import type { CitizenId } from '../contracts/ids.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { deterministicSample, type ProbabilityUnit } from './deterministic-sample.js';
import type { MacroHourIndex } from '@web-three-city/simulation-core';

export type QualificationResolverContext =
  'working-age-immigrant' | 'resident-reaching-working-age';

export interface QualificationResolverInput {
  readonly citizenId: CitizenId;
  readonly context: QualificationResolverContext;
  readonly evaluationMacroHourIndex: MacroHourIndex;
  readonly deterministicSeed: number;
}

export interface QualificationResolver {
  resolve(input: Readonly<QualificationResolverInput>): string;
}

export interface QualificationResolverOptions {
  readonly sample?: (input: Readonly<QualificationResolverInput>) => ProbabilityUnit;
}

export function createFoundationQualificationResolver(
  registries: RciDefinitionRegistries,
  options: QualificationResolverOptions = {},
): QualificationResolver {
  const sampleFor: (input: Readonly<QualificationResolverInput>) => ProbabilityUnit =
    options.sample ??
    ((input: Readonly<QualificationResolverInput>) =>
      deterministicSample({
        seed: input.deterministicSeed,
        eventType: `qualification:${input.context}`,
        evaluationMacroHourIndex: input.evaluationMacroHourIndex,
        entityStableId: input.citizenId,
        attemptIndex: 0,
      }));

  return Object.freeze({
    resolve(input: Readonly<QualificationResolverInput>): string {
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
