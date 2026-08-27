import { describe, expect, it } from 'vitest';
import {
  absoluteGameMinute,
  crossedMacroHour,
  deriveGameCalendarFromGameMinute,
  deriveMacroHourIndex,
  deriveMacroHourTransition,
  deriveSimulationCycleIndex,
  isDevelopmentEvaluationTick,
  macroHourIndex,
  macroHourValue,
} from '../src/index.js';

describe('compressed game calendar projection', () => {
  it.each([
    [0, { year: 1, month: 1, hour: 0, minute: 0 }],
    [59, { year: 1, month: 1, hour: 0, minute: 59 }],
    [60, { year: 1, month: 1, hour: 1, minute: 0 }],
    [1439, { year: 1, month: 1, hour: 23, minute: 59 }],
    [1440, { year: 1, month: 2, hour: 0, minute: 0 }],
    [17279, { year: 1, month: 12, hour: 23, minute: 59 }],
    [17280, { year: 2, month: 1, hour: 0, minute: 0 }],
  ] as const)('projects absolute minute %i without a mutable day field', (minute, expected) => {
    expect(deriveGameCalendarFromGameMinute(absoluteGameMinute(minute))).toEqual(expected);
  });

  it('derives the zero-based simulation cycle from absolute minutes', () => {
    expect(deriveSimulationCycleIndex(absoluteGameMinute(0))).toBe(0);
    expect(deriveSimulationCycleIndex(absoluteGameMinute(1439))).toBe(0);
    expect(deriveSimulationCycleIndex(absoluteGameMinute(1440))).toBe(1);
    expect(deriveSimulationCycleIndex(absoluteGameMinute(17280))).toBe(12);
  });

  it('keeps macro-hour transitions and evaluation cadence unchanged', () => {
    expect(macroHourValue(deriveMacroHourIndex(absoluteGameMinute(539)))).toBe(8);
    expect(macroHourValue(deriveMacroHourIndex(absoluteGameMinute(540)))).toBe(9);
    expect(crossedMacroHour(absoluteGameMinute(539), absoluteGameMinute(540))).toBe(true);
    expect(deriveMacroHourTransition(absoluteGameMinute(59), absoluteGameMinute(60)).crossed).toBe(
      true,
    );
    expect([0, 6, 12, 18].map(macroHourIndex).every(isDevelopmentEvaluationTick)).toBe(true);
    expect(isDevelopmentEvaluationTick(macroHourIndex(8))).toBe(false);
  });
});
