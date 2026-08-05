import { describe, expect, it } from 'vitest';
import { deriveGameCalendar, isDevelopmentEvaluationTick } from '../src/index.js';

describe('simple game calendar', () => {
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
