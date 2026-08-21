import { describe, expect, it } from 'vitest';
import {
  crossedMacroHour,
  deriveGameCalendar,
  deriveGameCalendarFromGameMinute,
  deriveMacroHourIndex,
  isDevelopmentEvaluationTick,
} from '../src/index.js';

describe('simple game calendar', () => {
  it('derives the legacy 08:00 calendar position from game minute 480', () => {
    expect(deriveMacroHourIndex(480)).toBe(8);
    expect(deriveGameCalendarFromGameMinute(480)).toEqual({
      year: 1,
      month: 1,
      day: 1,
      hour: 8,
    });
  });

  it('keeps minutes before 09:00 in macro hour eight and crosses at minute 540', () => {
    expect(deriveMacroHourIndex(539)).toBe(8);
    expect(deriveMacroHourIndex(540)).toBe(9);
    expect(crossedMacroHour(480, 539)).toBe(false);
    expect(crossedMacroHour(539, 540)).toBe(true);
  });

  it('derives the initial calendar from absolute tick eight', () => {
    expect(deriveGameCalendar(8)).toEqual({ year: 1, month: 1, day: 1, hour: 8 });
  });

  it('rolls exact day, month, and year boundaries', () => {
    expect(deriveGameCalendar(24)).toEqual({ year: 1, month: 1, day: 2, hour: 0 });
    expect(deriveGameCalendar(24 * 30)).toEqual({ year: 1, month: 2, day: 1, hour: 0 });
    expect(deriveGameCalendar(24 * 30 * 12)).toEqual({
      year: 2,
      month: 1,
      day: 1,
      hour: 0,
    });
  });

  it('rejects invalid ticks and identifies evaluation hours', () => {
    expect(() => deriveGameCalendar(-1)).toThrow('simulation-calendar:invalid-tick');
    expect(() => deriveGameCalendar(1.5)).toThrow('simulation-calendar:invalid-tick');
    expect([0, 6, 12, 18].every(isDevelopmentEvaluationTick)).toBe(true);
    expect(isDevelopmentEvaluationTick(8)).toBe(false);
  });
});
