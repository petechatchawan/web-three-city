import { INITIAL_ABSOLUTE_TICK, MINUTES_PER_HOUR } from './calendar.js';
import { absoluteGameMinute } from './temporal-units.js';
import type { SimulationSnapshot, SimulationSnapshotInput } from './contracts.js';

export function createSimulationSnapshot(input: SimulationSnapshotInput): SimulationSnapshot {
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new RangeError('simulation-snapshot:invalid-revision');
  }
  const validatedAbsoluteGameMinute = absoluteGameMinute(input.absoluteGameMinute);
  if (!Number.isSafeInteger(input.growthSequence) || input.growthSequence < 0) {
    throw new RangeError('simulation-snapshot:invalid-growth-sequence');
  }
  return Object.freeze({
    revision: input.revision,
    absoluteGameMinute: validatedAbsoluteGameMinute,
    growthSequence: input.growthSequence,
  });
}

export function createInitialSimulationSnapshot(): SimulationSnapshot {
  return createSimulationSnapshot({
    revision: 0,
    absoluteGameMinute: absoluteGameMinute(INITIAL_ABSOLUTE_TICK * MINUTES_PER_HOUR),
    growthSequence: 0,
  });
}
