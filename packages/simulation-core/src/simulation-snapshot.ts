import { INITIAL_ABSOLUTE_TICK, assertAbsoluteTick } from './calendar.js';
import type { SimulationSnapshot } from './contracts.js';

export function createSimulationSnapshot(input: SimulationSnapshot): SimulationSnapshot {
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new RangeError('simulation-snapshot:invalid-revision');
  }
  assertAbsoluteTick(input.absoluteTick);
  if (!Number.isSafeInteger(input.growthSequence) || input.growthSequence < 0) {
    throw new RangeError('simulation-snapshot:invalid-growth-sequence');
  }
  return Object.freeze({
    revision: input.revision,
    absoluteTick: input.absoluteTick,
    growthSequence: input.growthSequence,
  });
}

export function createInitialSimulationSnapshot(): SimulationSnapshot {
  return createSimulationSnapshot({
    revision: 0,
    absoluteTick: INITIAL_ABSOLUTE_TICK,
    growthSequence: 0,
  });
}
