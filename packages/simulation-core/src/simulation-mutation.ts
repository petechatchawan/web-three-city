import {
  SimulationContractError,
  type SimulationMinutePlan,
  type SimulationMinuteReceipt,
  type SimulationSnapshot,
} from './contracts.js';
import {
  addGameMinutes,
  compareGameMinutes,
  gameMinuteDuration,
  gameMinuteValue,
} from './temporal-units.js';
import { createSimulationSnapshot } from './simulation-snapshot.js';

export function planSimulationMinute(snapshot: SimulationSnapshot): SimulationMinutePlan {
  try {
    const validated = createSimulationSnapshot(snapshot);
    if (gameMinuteValue(validated.absoluteGameMinute) === Number.MAX_SAFE_INTEGER) {
      return Object.freeze({
        baseRevision: validated.revision,
        beforeAbsoluteGameMinute: validated.absoluteGameMinute,
        afterAbsoluteGameMinute: validated.absoluteGameMinute,
        valid: false,
        invalidReason: 'simulation:minute-overflow',
      });
    }
    return Object.freeze({
      baseRevision: validated.revision,
      beforeAbsoluteGameMinute: validated.absoluteGameMinute,
      afterAbsoluteGameMinute: addGameMinutes(validated.absoluteGameMinute, gameMinuteDuration(1)),
      valid: true,
      invalidReason: null,
    });
  } catch {
    return Object.freeze({
      baseRevision: snapshot.revision,
      beforeAbsoluteGameMinute: snapshot.absoluteGameMinute,
      afterAbsoluteGameMinute: snapshot.absoluteGameMinute,
      valid: false,
      invalidReason: 'simulation:invalid-state',
    });
  }
}

export function commitSimulationMinute(
  snapshot: SimulationSnapshot,
  plan: SimulationMinutePlan,
  nextGrowthSequence: number = snapshot.growthSequence,
): { readonly snapshot: SimulationSnapshot; readonly receipt: SimulationMinuteReceipt } {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new SimulationContractError('simulation:invalid-plan');
  }
  const validated = createSimulationSnapshot(snapshot);
  if (
    validated.revision !== plan.baseRevision ||
    compareGameMinutes(validated.absoluteGameMinute, plan.beforeAbsoluteGameMinute) !== 0
  ) {
    throw new SimulationContractError('simulation:stale-plan');
  }
  const next = createSimulationSnapshot({
    revision: validated.revision + 1,
    absoluteGameMinute: plan.afterAbsoluteGameMinute,
    growthSequence: nextGrowthSequence,
  });
  return Object.freeze({
    snapshot: next,
    receipt: Object.freeze({
      beforeRevision: validated.revision,
      afterRevision: next.revision,
      beforeAbsoluteGameMinute: validated.absoluteGameMinute,
      afterAbsoluteGameMinute: next.absoluteGameMinute,
    }),
  });
}
