import { macroHourIndex, type MacroHourIndex } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  RCI_CYCLES_PER_CALENDAR_YEAR,
  RCI_DAYS_PER_YEAR,
  RCI_MACRO_HOURS_PER_CALENDAR_YEAR,
  RCI_TICKS_PER_DAY,
  RCI_TICKS_PER_YEAR,
  RciContractError,
  ageBandAtMacroHour,
  ageBandAtTick,
  ageYearsAtMacroHour,
  ageYearsAtTick,
  isDailyLifecycleTick,
} from '../src/index.js';

describe('RCI age and daily lifecycle boundaries', () => {
  it('increments age at 288 macro hours instead of the legacy 8640-hour year', () => {
    expect(ageYearsAtTick(0, 287)).toBe(0);
    expect(ageYearsAtTick(0, 288)).toBe(1);
  });

  it('derives age from checked MacroHourIndex values using the compressed calendar year', () => {
    expect(RCI_CYCLES_PER_CALENDAR_YEAR).toBe(12);
    expect(RCI_MACRO_HOURS_PER_CALENDAR_YEAR).toBe(288);

    expect(ageYearsAtMacroHour(macroHourIndex(0), macroHourIndex(287))).toBe(0);
    expect(ageYearsAtMacroHour(macroHourIndex(0), macroHourIndex(288))).toBe(1);
  });

  it('retains temporary tick age exports as aliases of compressed calendar semantics', () => {
    expect(RCI_DAYS_PER_YEAR).toBe(12);
    expect(RCI_TICKS_PER_DAY).toBe(24);
    expect(RCI_TICKS_PER_YEAR).toBe(288);
    expect(ageYearsAtTick(-18 * RCI_TICKS_PER_YEAR, 0)).toBe(18);
  });

  it('uses the canonical age-band boundaries', () => {
    expect(ageBandAtTick(0, 6 * 288 - 1)).toBe('age-band.early-childhood');
    expect(ageBandAtTick(0, 6 * 288)).toBe('age-band.school-age');
    expect(ageBandAtTick(0, 18 * 288)).toBe('age-band.working-age');
    expect(ageBandAtTick(0, 65 * 288)).toBe('age-band.senior');
  });

  it('derives age bands from checked MacroHourIndex values', () => {
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

  it('rejects future births and unsafe arithmetic', () => {
    expect(() => ageYearsAtTick(9, 8)).toThrowError(new RciContractError('rci:invalid-state'));
    expect(() => ageYearsAtTick(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
  });

  it('rejects invalid checked MacroHourIndex inputs', () => {
    const invalidNegativeMacroHour = -1 as unknown as MacroHourIndex;
    const invalidUnsafeMacroHour = (Number.MAX_SAFE_INTEGER + 1) as unknown as MacroHourIndex;

    expect(() => ageYearsAtMacroHour(macroHourIndex(9), macroHourIndex(8))).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
    expect(() => ageYearsAtMacroHour(invalidNegativeMacroHour, macroHourIndex(0))).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
    expect(() => ageBandAtMacroHour(macroHourIndex(0), invalidUnsafeMacroHour)).toThrowError(
      new RciContractError('rci:invalid-state'),
    );
  });

  it('detects only transitions into the daily 08:00 boundary', () => {
    expect(RCI_TICKS_PER_DAY).toBe(24);
    expect(isDailyLifecycleTick(7, 8)).toBe(true);
    expect(isDailyLifecycleTick(8, 9)).toBe(false);
    expect(isDailyLifecycleTick(23, 24)).toBe(false);
    expect(isDailyLifecycleTick(31, 32)).toBe(true);
    expect(isDailyLifecycleTick(8, 8)).toBe(false);
  });
});
