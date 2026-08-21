import { INITIAL_ABSOLUTE_TICK, MINUTES_PER_HOUR } from './calendar.js';
import type { SimulationSnapshot } from './contracts.js';

export function createSimulationSnapshot(input: SimulationSnapshot): SimulationSnapshot {
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new RangeError('simulation-snapshot:invalid-revision');
  }
  if (!Number.isSafeInteger(input.absoluteGameMinute) || input.absoluteGameMinute < 0) {
    throw new RangeError('simulation-snapshot:invalid-game-minute');
  }
  if (!Number.isSafeInteger(input.growthSequence) || input.growthSequence < 0) {
    throw new RangeError('simulation-snapshot:invalid-growth-sequence');
  }
  return Object.freeze({
    revision: input.revision,
    absoluteGameMinute: input.absoluteGameMinute,
    growthSequence: input.growthSequence,
  });
}

export function createInitialSimulationSnapshot(): SimulationSnapshot {
  return createSimulationSnapshot({
    revision: 0,
    absoluteGameMinute: INITIAL_ABSOLUTE_TICK * MINUTES_PER_HOUR,
    growthSequence: 0,
  });
}
