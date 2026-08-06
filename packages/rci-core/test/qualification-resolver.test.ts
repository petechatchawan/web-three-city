import { describe, expect, it } from 'vitest';
import {
  createFoundationQualificationResolver,
  planAwardCitizenQualification,
} from '../src/index.js';
import { createSingleResidentSnapshot, testRegistries } from './population-fixtures.js';

describe('RCI qualification resolver and history', () => {
  it('uses the exact working-age immigrant thresholds', () => {
    const resolveAt = (sample: number) =>
      createFoundationQualificationResolver(testRegistries, {
        sample: () => sample,
      }).resolve({
        citizenId: 'citizen:1',
        context: 'working-age-immigrant',
        evaluationTick: 32,
        deterministicSeed: 7,
      });

    expect(resolveAt(0)).toBe('qualification.entry');
    expect(resolveAt(549_999_999)).toBe('qualification.entry');
    expect(resolveAt(550_000_000)).toBe('qualification.skilled');
    expect(resolveAt(869_999_999)).toBe('qualification.skilled');
    expect(resolveAt(870_000_000)).toBe('qualification.professional');
  });

  it('uses the exact resident-reaching-working-age thresholds', () => {
    const resolveAt = (sample: number) =>
      createFoundationQualificationResolver(testRegistries, {
        sample: () => sample,
      }).resolve({
        citizenId: 'citizen:1',
        context: 'resident-reaching-working-age',
        evaluationTick: 32,
        deterministicSeed: 7,
      });

    expect(resolveAt(699_999_999)).toBe('qualification.entry');
    expect(resolveAt(700_000_000)).toBe('qualification.skilled');
    expect(resolveAt(949_999_999)).toBe('qualification.skilled');
    expect(resolveAt(950_000_000)).toBe('qualification.professional');
  });

  it('appends immutable qualification history and increments one sequence', () => {
    const snapshot = createSingleResidentSnapshot();
    const plan = planAwardCitizenQualification({
      snapshot,
      citizenId: 'citizen:1',
      qualificationDefinitionId: 'qualification.skilled',
      awardedAtTick: 20,
      sourceDefinitionId: 'qualification-source.fixture',
      registries: testRegistries,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.population.qualifications).toContainEqual({
      citizenQualificationId: 'citizen-qualification:1',
      citizenId: 'citizen:1',
      qualificationDefinitionId: 'qualification.skilled',
      awardedAtTick: 20,
      endedAtTick: null,
      sourceDefinitionId: 'qualification-source.fixture',
    });
    expect(plan.proposedSnapshot.sequences.nextCitizenQualification).toBe(2);
  });

  it('does not re-award an active workforce qualification', () => {
    const snapshot = createSingleResidentSnapshot();
    const first = planAwardCitizenQualification({
      snapshot,
      citizenId: 'citizen:1',
      qualificationDefinitionId: 'qualification.entry',
      awardedAtTick: 20,
      sourceDefinitionId: 'qualification-source.fixture',
      registries: testRegistries,
    });
    const second = planAwardCitizenQualification({
      snapshot: first.proposedSnapshot,
      citizenId: 'citizen:1',
      qualificationDefinitionId: 'qualification.skilled',
      awardedAtTick: 21,
      sourceDefinitionId: 'qualification-source.fixture',
      registries: testRegistries,
    });

    expect(second.valid).toBe(false);
    expect(second.proposedSnapshot).toBe(first.proposedSnapshot);
    expect(second.proposedSnapshot.sequences.nextCitizenQualification).toBe(2);
  });
});
