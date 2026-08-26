import type { MacroHourIndex } from '@web-three-city/simulation-core';
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
    evaluationMacroHourIndex: MacroHourIndex;
  }>,
): RciGrowthGateState {
  return Object.freeze({
    residentialOpen: nextGate(input.previous.residentialOpen, input.demand.residentialMilli),
    commercialOpen: nextGate(input.previous.commercialOpen, input.demand.commercialMilli),
    industrialOpen: nextGate(input.previous.industrialOpen, input.demand.industrialMilli),
    evaluatedAtMacroHourIndex: input.evaluationMacroHourIndex,
  });
}
