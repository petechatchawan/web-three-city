import { describe, expect, it } from 'vitest';
import {
  commitSimulationMinute,
  createSimulationSnapshot,
  planSimulationMinute,
} from '../src/index.js';

describe('simulation minute mutation', () => {
  it('advances the canonical snapshot by exactly one game minute with revision fencing', () => {
    const before = createSimulationSnapshot({
      revision: 4,
      absoluteGameMinute: 480,
      growthSequence: 9,
    });
    const plan = planSimulationMinute(before);
    const committed = commitSimulationMinute(before, plan);
    expect(committed.snapshot).toEqual({
      revision: 5,
      absoluteGameMinute: 481,
      growthSequence: 9,
    });
    expect(committed.receipt).toEqual({
      beforeRevision: 4,
      afterRevision: 5,
      beforeAbsoluteGameMinute: 480,
      afterAbsoluteGameMinute: 481,
    });
    expect(() => commitSimulationMinute(committed.snapshot, plan)).toThrow('simulation:stale-plan');
  });
});
