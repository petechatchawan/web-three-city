import {
  SimulationContractError,
  type SimulationSnapshot,
  type SimulationTickPlan,
  type SimulationTickReceipt,
} from './contracts.js';
import { createSimulationSnapshot } from './simulation-snapshot.js';

export function planSimulationTick(snapshot: SimulationSnapshot): SimulationTickPlan {
  try {
    const validated = createSimulationSnapshot(snapshot);
    if (validated.absoluteTick === Number.MAX_SAFE_INTEGER) {
      return Object.freeze({
        baseRevision: validated.revision,
        beforeAbsoluteTick: validated.absoluteTick,
        afterAbsoluteTick: validated.absoluteTick,
        valid: false,
        invalidReason: 'simulation:tick-overflow',
      });
    }
    return Object.freeze({
      baseRevision: validated.revision,
      beforeAbsoluteTick: validated.absoluteTick,
      afterAbsoluteTick: validated.absoluteTick + 1,
      valid: true,
      invalidReason: null,
    });
  } catch {
    return Object.freeze({
      baseRevision: snapshot.revision,
      beforeAbsoluteTick: snapshot.absoluteTick,
      afterAbsoluteTick: snapshot.absoluteTick,
      valid: false,
      invalidReason: 'simulation:invalid-state',
    });
  }
}

export function commitSimulationTick(
  snapshot: SimulationSnapshot,
  plan: SimulationTickPlan,
  nextGrowthSequence: number = snapshot.growthSequence,
): { readonly snapshot: SimulationSnapshot; readonly receipt: SimulationTickReceipt } {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new SimulationContractError('simulation:invalid-plan');
  }
  const validated = createSimulationSnapshot(snapshot);
  if (
    validated.revision !== plan.baseRevision ||
    validated.absoluteTick !== plan.beforeAbsoluteTick
  ) {
    throw new SimulationContractError('simulation:stale-plan');
  }
  const next = createSimulationSnapshot({
    revision: validated.revision + 1,
    absoluteTick: plan.afterAbsoluteTick,
    growthSequence: nextGrowthSequence,
  });
  return Object.freeze({
    snapshot: next,
    receipt: Object.freeze({
      beforeRevision: validated.revision,
      afterRevision: next.revision,
      beforeAbsoluteTick: validated.absoluteTick,
      afterAbsoluteTick: next.absoluteTick,
    }),
  });
}
