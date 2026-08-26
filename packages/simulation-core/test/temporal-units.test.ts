import { describe, expect, it } from 'vitest';
import {
  absoluteGameMinute,
  addGameMinutes,
  addMacroHours,
  compareGameMinutes,
  compareMacroHours,
  gameMinuteDuration,
  gameMinuteValue,
  macroHourDuration,
  macroHourIndex,
  macroHourValue,
} from '../src/index.js';

describe('explicit temporal units', () => {
  it('accepts non-negative safe integer temporal values', () => {
    expect(gameMinuteValue(absoluteGameMinute(0))).toBe(0);
    expect(gameMinuteValue(absoluteGameMinute(123))).toBe(123);
    expect(gameMinuteValue(gameMinuteDuration(5))).toBe(5);

    expect(macroHourValue(macroHourIndex(0))).toBe(0);
    expect(macroHourValue(macroHourIndex(12))).toBe(12);
    expect(macroHourValue(macroHourDuration(6))).toBe(6);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid temporal value %s',
    (value) => {
      expect(() => absoluteGameMinute(value)).toThrow(RangeError);
      expect(() => gameMinuteDuration(value)).toThrow(RangeError);
      expect(() => macroHourIndex(value)).toThrow(RangeError);
      expect(() => macroHourDuration(value)).toThrow(RangeError);
    },
  );

  it('adds durations to matching temporal points', () => {
    expect(gameMinuteValue(addGameMinutes(absoluteGameMinute(59), gameMinuteDuration(1)))).toBe(60);

    expect(macroHourValue(addMacroHours(macroHourIndex(12), macroHourDuration(6)))).toBe(18);
  });

  it('compares matching temporal points', () => {
    expect(compareGameMinutes(absoluteGameMinute(1), absoluteGameMinute(2))).toBe(-1);
    expect(compareGameMinutes(absoluteGameMinute(2), absoluteGameMinute(2))).toBe(0);
    expect(compareGameMinutes(absoluteGameMinute(3), absoluteGameMinute(2))).toBe(1);

    expect(compareMacroHours(macroHourIndex(1), macroHourIndex(2))).toBe(-1);
    expect(compareMacroHours(macroHourIndex(2), macroHourIndex(2))).toBe(0);
    expect(compareMacroHours(macroHourIndex(3), macroHourIndex(2))).toBe(1);
  });
});
