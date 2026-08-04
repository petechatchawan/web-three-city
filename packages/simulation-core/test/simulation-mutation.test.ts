import { describe, expect, it } from 'vitest';
import {
  commitSimulationTick,
  createInitialSimulationSnapshot,
  planSimulationTick,
} from '../src/index.js';

describe('simulation tick mutation', () => {
  it('advances exactly one logical tick with revision fencing', () => {
    const before = createInitialSimulationSnapshot();
    const plan = planSimulationTick(before);
    const committed = commitSimulationTick(before, plan);
    expect(committed.snapshot).toEqual({
      revision: 1,
      absoluteTick: 9,
      growthSequence: 0,
    });
    expect(() => commitSimulationTick(committed.snapshot, plan)).toThrow('simulation:stale-plan');
  });
});
