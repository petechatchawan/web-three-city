import { describe, expect, it } from 'vitest';
import {
  PROBABILITY_SCALE,
  RciContractError,
  compileAnnualRateToDailyHazard,
  compileAnnualRateToCycleHazard,
  sampleSucceeds,
} from '../src/index.js';

describe('RCI annual-rate hazard compilation', () => {
  it('compounds a compiled cycle hazard to the annual rate across twelve evaluations', () => {
    for (const annualRateMillionth of [1, 100, 25_000, 300_000, 500_000, 900_000, 999_999]) {
      const cycleHazard = compileAnnualRateToCycleHazard(annualRateMillionth);
      const compoundedAnnualRateMillionth = Math.round(
        (1 - (1 - cycleHazard / PROBABILITY_SCALE) ** 12) * 1_000_000,
      );

      expect(Math.abs(compoundedAnnualRateMillionth - annualRateMillionth)).toBeLessThanOrEqual(1);
    }
  });

  it('uses twelve-cycle golden values and keeps the old daily export as a compatibility alias', () => {
    const cases = [
      [0, 0],
      [100, 8_334],
      [500, 41_676],
      [1_000, 83_372],
      [4_000, 333_946],
      [25_000, 2_107_593],
      [90_000, 7_828_420],
      [300_000, 29_285_530],
      [1_000_000, PROBABILITY_SCALE],
    ] as const;

    for (const [annualRateMillionth, expectedHazard] of cases) {
      expect(compileAnnualRateToCycleHazard(annualRateMillionth)).toBe(expectedHazard);
      expect(compileAnnualRateToDailyHazard(annualRateMillionth)).toBe(expectedHazard);
    }
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001])(
    'rejects invalid authored annual rate %s',
    (annualRateMillionth) => {
      expect(() => compileAnnualRateToCycleHazard(annualRateMillionth)).toThrowError(
        new RciContractError('rci:invalid-state'),
      );
      expect(() => compileAnnualRateToDailyHazard(annualRateMillionth)).toThrowError(
        new RciContractError('rci:invalid-state'),
      );
    },
  );

  it('keeps zero and certain annual probabilities exact', () => {
    expect(compileAnnualRateToCycleHazard(0)).toBe(0);
    expect(compileAnnualRateToCycleHazard(1_000_000)).toBe(PROBABILITY_SCALE);
  });

  it('uses strict integer probability comparisons', () => {
    expect(sampleSucceeds(0, 0)).toBe(false);
    expect(sampleSucceeds(99, 100)).toBe(true);
    expect(sampleSucceeds(100, 100)).toBe(false);
    expect(sampleSucceeds(PROBABILITY_SCALE - 1, PROBABILITY_SCALE)).toBe(true);
  });
});
