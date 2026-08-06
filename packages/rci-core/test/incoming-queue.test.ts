import { describe, expect, it } from 'vitest';
import { orderIncomingHouseholdRequests } from '../src/index.js';

const requests = [
  {
    requestId: 'incoming-household:2',
    archetypeDefinitionId: 'migration.couple.v1',
    requestedAtTick: 32,
    minimumResidentCapacity: 2,
    queuePriority: 0,
    deterministicSequence: 2,
  },
  {
    requestId: 'incoming-household:1',
    archetypeDefinitionId: 'migration.single-adult.v1',
    requestedAtTick: 32,
    minimumResidentCapacity: 1,
    queuePriority: 1,
    deterministicSequence: 1,
  },
] as const;

describe('incoming Household queue', () => {
  it('uses priority, time, deterministic sequence, then stable ID', () => {
    const expected = ['incoming-household:1', 'incoming-household:2'];
    expect(orderIncomingHouseholdRequests(requests).map((value) => value.requestId)).toEqual(
      expected,
    );
    expect(
      orderIncomingHouseholdRequests([...requests].reverse()).map((value) => value.requestId),
    ).toEqual(expected);
  });
});
