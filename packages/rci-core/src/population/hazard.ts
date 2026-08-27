import { RciContractError } from '../contracts/errors.js';
import { RCI_CYCLES_PER_CALENDAR_YEAR } from './age.js';
import { PROBABILITY_SCALE, type ProbabilityUnit } from './deterministic-sample.js';

export const ANNUAL_RATE_SCALE = 1_000_000;

function assertAnnualRate(annualRateMillionth: number): void {
  if (
    !Number.isSafeInteger(annualRateMillionth) ||
    annualRateMillionth < 0 ||
    annualRateMillionth > ANNUAL_RATE_SCALE
  ) {
    throw new RciContractError('rci:invalid-state');
  }
}

export function compileAnnualRateToCycleHazard(annualRateMillionth: number): ProbabilityUnit {
  assertAnnualRate(annualRateMillionth);
  if (annualRateMillionth === 0) return 0;
  if (annualRateMillionth === ANNUAL_RATE_SCALE) return PROBABILITY_SCALE;

  const annualRate = annualRateMillionth / ANNUAL_RATE_SCALE;
  const cycleRate = 1 - (1 - annualRate) ** (1 / RCI_CYCLES_PER_CALENDAR_YEAR);
  return Math.round(cycleRate * PROBABILITY_SCALE);
}

/** @deprecated Use compileAnnualRateToCycleHazard. */
export const compileAnnualRateToDailyHazard = compileAnnualRateToCycleHazard;

export function sampleSucceeds(sample: ProbabilityUnit, hazard: ProbabilityUnit): boolean {
  if (
    !Number.isSafeInteger(sample) ||
    sample < 0 ||
    sample >= PROBABILITY_SCALE ||
    !Number.isSafeInteger(hazard) ||
    hazard < 0 ||
    hazard > PROBABILITY_SCALE
  ) {
    throw new RciContractError('rci:invalid-state');
  }
  return sample < hazard;
}
