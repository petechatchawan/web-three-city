import { macroHourIndex, type MacroHourIndex } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  RCI_CYCLES_PER_CALENDAR_YEAR,
  RCI_MACRO_HOURS_PER_CALENDAR_YEAR,
  RCI_MACRO_HOURS_PER_SIMULATION_CYCLE,
  RciContractError,
  ageOriginMacroHour,
  ageOriginMacroHourValue,
  ageBandAtMacroHour,
  ageYearsAtMacroHour,
  isPopulationLifecycleCycle,
} from '../src/index.js';

describe('RCI age and population lifecycle boundaries', () => {
  it('increments age at 288 macro hours instead of the legacy 8640-hour year', () => {
    expect(ageYearsAtMacroHour(macroHourIndex(0), macroHourIndex(287))).toBe(0);
    expect(ageYearsAtMacroHour(macroHourIndex(0), macroHourIndex(288))).toBe(1);
  });

  it('derives the compressed calendar constants', () => {
    expect(RCI_CYCLES_PER_CALENDAR_YEAR).toBe(12);
    expect(RCI_MACRO_HOURS_PER_SIMULATION_CYCLE).toBe(24);
    expect(RCI_MACRO_HOURS_PER_CALENDAR_YEAR).toBe(288);
  });

  it('uses the canonical age-band boundaries', () => {
    expect(ageBandAtMacroHour(macroHourIndex(0), macroHourIndex(6 * 288 - 1))).toBe(
      'age-band.early-childhood',
    );
    expect(ageBandAtMacroHour(macroHourIndex(0), macroHourIndex(6 * 288))).toBe(
      'age-band.school-age',
    );
    expect(ageBandAtMacroHour(macroHourIndex(0), macroHourIndex(18 * 288))).toBe(
      'age-band.working-age',
    );
    expect(ageBandAtMacroHour(macroHourIndex(0), macroHourIndex(65 * 288))).toBe('age-band.senior');
  });

  it('rejects future and invalid MacroHourIndex values', () => {
    expect(() => ageYearsAtMacroHour(macroHourIndex(9), macroHourIndex(8))).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
    const invalidNegativeMacroHour = -1 as unknown as MacroHourIndex;
    const invalidUnsafeMacroHour = (Number.MAX_SAFE_INTEGER + 1) as unknown as MacroHourIndex;
    expect(() => ageYearsAtMacroHour(macroHourIndex(0), invalidNegativeMacroHour)).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
    expect(() => ageBandAtMacroHour(macroHourIndex(0), invalidUnsafeMacroHour)).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
  });

  it('supports signed pre-epoch age origins without weakening MacroHourIndex', () => {
    const origin = ageOriginMacroHour(-5_152);

    expect(ageOriginMacroHourValue(origin)).toBe(-5_152);
    expect(ageYearsAtMacroHour(origin, macroHourIndex(32))).toBe(18);
    expect(ageBandAtMacroHour(origin, macroHourIndex(32))).toBe('age-band.working-age');
    expect(() => ageOriginMacroHour(1.5)).toThrowError(new RciContractError('rci:invalid-state'));
  });

  it('detects only transitions into the daily 08:00 population lifecycle boundary', () => {
    expect(isPopulationLifecycleCycle(macroHourIndex(7), macroHourIndex(8))).toBe(true);
    expect(isPopulationLifecycleCycle(macroHourIndex(8), macroHourIndex(9))).toBe(false);
    expect(isPopulationLifecycleCycle(macroHourIndex(23), macroHourIndex(24))).toBe(false);
    expect(isPopulationLifecycleCycle(macroHourIndex(31), macroHourIndex(32))).toBe(true);
    expect(isPopulationLifecycleCycle(macroHourIndex(8), macroHourIndex(8))).toBe(false);
  });
});
