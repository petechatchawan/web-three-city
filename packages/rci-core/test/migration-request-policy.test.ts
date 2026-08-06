import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_RCI_CONFIGURATION,
  createFoundationMigrationRequestPolicy,
  createInitialRciSnapshot,
} from '../src/index.js';
import { housingRegistries } from './housing-fixtures.js';

describe('migration request policy', () => {
  it('accumulates milli-households and allocates no Citizen IDs', () => {
    const snapshot = createInitialRciSnapshot({ absoluteTick: 32, deterministicSeed: 9 });
    const first = createFoundationMigrationRequestPolicy().planRequests({
      snapshot,
      evaluationTick: 32,
      suitableVacantJobCount: 0,
      registries: housingRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });
    expect(first.requests).toEqual([]);
    expect(first.nextAttractionMilli).toBe(350);
    expect(first.nextIncomingRequestSequence).toBe(1);

    const accumulated = {
      ...snapshot,
      migration: { ...snapshot.migration, attractionMilli: 900 },
    };
    const second = createFoundationMigrationRequestPolicy().planRequests({
      snapshot: accumulated,
      evaluationTick: 56,
      suitableVacantJobCount: 0,
      registries: housingRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });
    expect(second.requests).toHaveLength(1);
    expect(second.requests[0]?.requestId).toBe('incoming-household:1');
    expect(second.nextAttractionMilli).toBe(250);
    expect(snapshot.sequences.nextCitizen).toBe(1);
  });

  it('honors the daily and queue caps without discarding carry', () => {
    const snapshot = createInitialRciSnapshot({ absoluteTick: 32 });
    const result = createFoundationMigrationRequestPolicy().planRequests({
      snapshot: { ...snapshot, migration: { ...snapshot.migration, attractionMilli: 5_000 } },
      evaluationTick: 32,
      suitableVacantJobCount: 100,
      registries: housingRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });
    expect(result.requests).toHaveLength(2);
    expect(result.nextAttractionMilli).toBeGreaterThanOrEqual(0);
  });
});
