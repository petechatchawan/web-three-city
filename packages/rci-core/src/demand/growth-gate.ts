import type { RciDemandState, RciGrowthGateState } from '../contracts/records.js';

function nextGate(previousOpen: boolean, demandMilli: number): boolean {
  if (demandMilli >= 15_000) return true;
  if (demandMilli <= 5_000) return false;
  return previousOpen;
}

export function updateRciGrowthGates(
  input: Readonly<{
    previous: RciGrowthGateState;
    demand: RciDemandState;
    evaluationTick: number;
  }>,
): RciGrowthGateState {
  return Object.freeze({
    residentialOpen: nextGate(input.previous.residentialOpen, input.demand.residentialMilli),
    commercialOpen: nextGate(input.previous.commercialOpen, input.demand.commercialMilli),
    industrialOpen: nextGate(input.previous.industrialOpen, input.demand.industrialMilli),
    evaluatedAtTick: input.evaluationTick,
  });
}
