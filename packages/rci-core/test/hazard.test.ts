import { describe, expect, it } from 'vitest';
import {
  PROBABILITY_SCALE,
  RciContractError,
  compileAnnualRateToDailyHazard,
  sampleSucceeds,
} from '../src/index.js';

describe('RCI annual-rate hazard compilation', () => {
  it('locks the 360-day conversion golden values', () => {
    expect(compileAnnualRateToDailyHazard(0)).toBe(0);
    expect(compileAnnualRateToDailyHazard(100)).toBe(278);
    expect(compileAnnualRateToDailyHazard(500)).toBe(1_389);
    expect(compileAnnualRateToDailyHazard(1_000)).toBe(2_779);
    expect(compileAnnualRateToDailyHazard(4_000)).toBe(11_133);
    expect(compileAnnualRateToDailyHazard(25_000)).toBe(70_325);
    expect(compileAnnualRateToDailyHazard(90_000)).toBe(261_940);
    expect(compileAnnualRateToDailyHazard(300_000)).toBe(990_273);
    expect(compileAnnualRateToDailyHazard(1_000_000)).toBe(PROBABILITY_SCALE);
  });

  it('rejects invalid authored annual rates', () => {
    expect(() => compileAnnualRateToDailyHazard(-1)).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
    expect(() => compileAnnualRateToDailyHazard(1_000_001)).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
  });

  it('uses strict integer probability comparisons', () => {
    expect(sampleSucceeds(0, 0)).toBe(false);
    expect(sampleSucceeds(99, 100)).toBe(true);
    expect(sampleSucceeds(100, 100)).toBe(false);
    expect(sampleSucceeds(PROBABILITY_SCALE - 1, PROBABILITY_SCALE)).toBe(true);
  });
});
