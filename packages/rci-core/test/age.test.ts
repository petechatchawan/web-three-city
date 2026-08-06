import { describe, expect, it } from 'vitest';
import {
  RCI_TICKS_PER_DAY,
  RCI_TICKS_PER_YEAR,
  RciContractError,
  ageBandAtTick,
  ageYearsAtTick,
  isDailyLifecycleTick,
} from '../src/index.js';

describe('RCI age and daily lifecycle boundaries', () => {
  it('derives immigrant age from negative birth ticks', () => {
    expect(ageYearsAtTick(-18 * RCI_TICKS_PER_YEAR, 0)).toBe(18);
  });

  it('uses the canonical age-band boundaries', () => {
    expect(ageBandAtTick(0, 6 * RCI_TICKS_PER_YEAR - 1)).toBe('age-band.early-childhood');
    expect(ageBandAtTick(0, 6 * RCI_TICKS_PER_YEAR)).toBe('age-band.school-age');
    expect(ageBandAtTick(0, 18 * RCI_TICKS_PER_YEAR)).toBe('age-band.working-age');
    expect(ageBandAtTick(0, 65 * RCI_TICKS_PER_YEAR)).toBe('age-band.senior');
  });

  it('rejects future births and unsafe arithmetic', () => {
    expect(() => ageYearsAtTick(9, 8)).toThrowError(new RciContractError('rci:invalid-state'));
    expect(() => ageYearsAtTick(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toThrowError(
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
