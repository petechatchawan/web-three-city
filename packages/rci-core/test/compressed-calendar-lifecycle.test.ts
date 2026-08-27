import { macroHourIndex } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  PROBABILITY_SCALE,
  RCI_CYCLES_PER_CALENDAR_YEAR,
  RCI_MACRO_HOURS_PER_CALENDAR_YEAR,
  ageBandAtMacroHour,
  ageOriginMacroHour,
  ageYearsAtMacroHour,
  compileAnnualRateToCycleHazard,
  deterministicSample,
  isPopulationLifecycleCycle,
} from '../src/index.js';

describe('compressed calendar lifecycle contract', () => {
  it('evaluates population lifecycle exactly once at 08:00 in each of twelve cycles', () => {
    const boundaries = Array.from({ length: RCI_CYCLES_PER_CALENDAR_YEAR }, (_, cycle) => {
      const before = macroHourIndex(7 + cycle * 24);
      const after = macroHourIndex(8 + cycle * 24);
      return isPopulationLifecycleCycle(before, after);
    });

    expect(boundaries).toEqual(Array.from({ length: 12 }, () => true));
    expect(isPopulationLifecycleCycle(macroHourIndex(8), macroHourIndex(9))).toBe(false);
    expect(isPopulationLifecycleCycle(macroHourIndex(23), macroHourIndex(24))).toBe(false);
  });

  it('increments age and age band at the compressed calendar-year boundary', () => {
    const birth = ageOriginMacroHour(0);

    expect(ageYearsAtMacroHour(birth, macroHourIndex(RCI_MACRO_HOURS_PER_CALENDAR_YEAR - 1))).toBe(
      0,
    );
    expect(ageYearsAtMacroHour(birth, macroHourIndex(RCI_MACRO_HOURS_PER_CALENDAR_YEAR))).toBe(1);
    expect(
      ageBandAtMacroHour(birth, macroHourIndex(18 * RCI_MACRO_HOURS_PER_CALENDAR_YEAR - 1)),
    ).toBe('age-band.school-age');
    expect(ageBandAtMacroHour(birth, macroHourIndex(18 * RCI_MACRO_HOURS_PER_CALENDAR_YEAR))).toBe(
      'age-band.working-age',
    );
  });

  it('compounds an authored annual probability across twelve lifecycle evaluations', () => {
    const annualRateMillionth = 300_000;
    const cycleHazard = compileAnnualRateToCycleHazard(annualRateMillionth);
    const compoundedAnnualRateMillionth = Math.round(
      (1 - (1 - cycleHazard / PROBABILITY_SCALE) ** RCI_CYCLES_PER_CALENDAR_YEAR) * 1_000_000,
    );

    expect(Math.abs(compoundedAnnualRateMillionth - annualRateMillionth)).toBeLessThanOrEqual(1);
  });

  it('replays deterministic lifecycle samples for the same seed and temporal points', () => {
    const evaluationPoints = Array.from({ length: RCI_CYCLES_PER_CALENDAR_YEAR }, (_, cycle) =>
      macroHourIndex(8 + cycle * 24),
    );
    const sample = (evaluationMacroHourIndex: ReturnType<typeof macroHourIndex>) =>
      deterministicSample({
        seed: 37,
        eventType: 'mortality',
        evaluationMacroHourIndex,
        entityStableId: 'citizen:1',
        attemptIndex: 0,
      });

    expect(evaluationPoints.map(sample)).toEqual(evaluationPoints.map(sample));
  });
});
