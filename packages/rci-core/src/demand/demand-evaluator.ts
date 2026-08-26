import type { MacroHourIndex } from '@web-three-city/simulation-core';
import { compareStableId } from '../contracts/ids.js';
import type { RciDemandState } from '../contracts/records.js';
import {
  clampDemandMilli,
  type RciDemandChannel,
  type RciDemandFactorContext,
  type RciDemandFactorContribution,
  type RciDemandFactorDefinition,
} from './demand-factor.js';

export interface RciDemandEvaluation {
  readonly rawResidentialMilli: number;
  readonly rawCommercialMilli: number;
  readonly rawIndustrialMilli: number;
  readonly contributions: readonly RciDemandFactorContribution[];
}

function evaluateChannel(
  channel: RciDemandChannel,
  context: RciDemandFactorContext,
  factors: readonly RciDemandFactorDefinition[],
): Readonly<{ valueMilli: number; contributions: readonly RciDemandFactorContribution[] }> {
  let weighted = 0;
  let weight = 0;
  const contributions: RciDemandFactorContribution[] = [];
  for (const factor of [...factors]
    .filter((value) => value.channel === channel)
    .sort((a, b) => compareStableId(a.id, b.id))) {
    if (!Number.isSafeInteger(factor.weightMilli) || factor.weightMilli < 0) {
      throw new RangeError('rci:invalid-demand-factor');
    }
    const valueMilli = clampDemandMilli(factor.evaluate(context));
    contributions.push(
      Object.freeze({
        factorDefinitionId: factor.id,
        channel,
        valueMilli,
        weightMilli: factor.weightMilli,
      }),
    );
    weighted += valueMilli * factor.weightMilli;
    weight += factor.weightMilli;
  }
  return Object.freeze({
    valueMilli: weight === 0 ? 0 : clampDemandMilli(weighted / weight),
    contributions: Object.freeze(contributions),
  });
}

export function evaluateRciDemand(
  context: RciDemandFactorContext,
  factors: readonly RciDemandFactorDefinition[],
): RciDemandEvaluation {
  const residential = evaluateChannel('residential', context, factors);
  const commercial = evaluateChannel('commercial', context, factors);
  const industrial = evaluateChannel('industrial', context, factors);
  const contributions = [
    ...residential.contributions,
    ...commercial.contributions,
    ...industrial.contributions,
  ].sort((a, b) => compareStableId(a.factorDefinitionId, b.factorDefinitionId));
  return Object.freeze({
    rawResidentialMilli: residential.valueMilli,
    rawCommercialMilli: commercial.valueMilli,
    rawIndustrialMilli: industrial.valueMilli,
    contributions: Object.freeze(contributions),
  });
}

function smooth(previous: number, target: number, smoothingMilli: number): number {
  if (!Number.isSafeInteger(smoothingMilli) || smoothingMilli < 0 || smoothingMilli > 1_000) {
    throw new RangeError('rci:invalid-demand-smoothing');
  }
  return clampDemandMilli(previous + Math.round(((target - previous) * smoothingMilli) / 1_000));
}

export function smoothRciDemand(
  input: Readonly<{
    previous: RciDemandState;
    evaluation: RciDemandEvaluation;
    evaluationMacroHourIndex: MacroHourIndex;
    smoothingMilli?: number;
  }>,
): RciDemandState {
  const smoothingMilli = input.smoothingMilli ?? 250;
  return Object.freeze({
    residentialMilli: smooth(
      input.previous.residentialMilli,
      input.evaluation.rawResidentialMilli,
      smoothingMilli,
    ),
    commercialMilli: smooth(
      input.previous.commercialMilli,
      input.evaluation.rawCommercialMilli,
      smoothingMilli,
    ),
    industrialMilli: smooth(
      input.previous.industrialMilli,
      input.evaluation.rawIndustrialMilli,
      smoothingMilli,
    ),
    evaluatedAtMacroHourIndex: input.evaluationMacroHourIndex,
  });
}
