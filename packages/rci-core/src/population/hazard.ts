import { RciContractError } from '../contracts/errors.js';
import { RCI_DAYS_PER_YEAR } from './age.js';
import { PROBABILITY_SCALE, type ProbabilityUnit } from './deterministic-sample.js';

export const ANNUAL_RATE_SCALE = 1_000_000;

export function compileAnnualRateToDailyHazard(
  annualRateMillionth: number,
): ProbabilityUnit {
  if (
    !Number.isSafeInteger(annualRateMillionth) ||
    annualRateMillionth < 0 ||
    annualRateMillionth > ANNUAL_RATE_SCALE
  ) {
    throw new RciContractError('rci:invalid-state');
  }
  if (annualRateMillionth === 0) return 0;
  if (annualRateMillionth === ANNUAL_RATE_SCALE) return PROBABILITY_SCALE;

  const annualRate = annualRateMillionth / ANNUAL_RATE_SCALE;
  const dailyRate = 1 - (1 - annualRate) ** (1 / RCI_DAYS_PER_YEAR);
  return Math.round(dailyRate * PROBABILITY_SCALE);
}

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
