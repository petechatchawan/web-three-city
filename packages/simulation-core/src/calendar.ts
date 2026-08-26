import type { GameCalendar, MacroHourTransition } from './contracts.js';
import { gameMinuteValue, macroHourIndex, macroHourValue } from './temporal-units.js';
import type { AbsoluteGameMinute, MacroHourIndex } from './temporal-units.js';

export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const INITIAL_ABSOLUTE_TICK = 8;
export const DEVELOPMENT_EVALUATION_HOURS = Object.freeze([0, 6, 12, 18] as const);

export function assertAbsoluteTick(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('simulation-calendar:invalid-tick');
  }
}

export function deriveMacroHourIndex(gameMinute: AbsoluteGameMinute): MacroHourIndex {
  return macroHourIndex(Math.floor(gameMinuteValue(gameMinute) / MINUTES_PER_HOUR));
}

export function crossedMacroHour(
  beforeMinute: AbsoluteGameMinute,
  afterMinute: AbsoluteGameMinute,
): boolean {
  return (
    macroHourValue(deriveMacroHourIndex(beforeMinute)) !==
    macroHourValue(deriveMacroHourIndex(afterMinute))
  );
}

export function deriveMacroHourTransition(
  beforeAbsoluteGameMinute: AbsoluteGameMinute,
  afterAbsoluteGameMinute: AbsoluteGameMinute,
): MacroHourTransition {
  const beforeMacroHourIndex = deriveMacroHourIndex(beforeAbsoluteGameMinute);
  const afterMacroHourIndex = deriveMacroHourIndex(afterAbsoluteGameMinute);
  return Object.freeze({
    beforeAbsoluteGameMinute,
    afterAbsoluteGameMinute,
    beforeMacroHourIndex,
    afterMacroHourIndex,
    crossed: beforeMacroHourIndex !== afterMacroHourIndex,
  });
}

export function isMacroHourTransition(value: MacroHourTransition): boolean {
  try {
    const derived = deriveMacroHourTransition(
      value.beforeAbsoluteGameMinute,
      value.afterAbsoluteGameMinute,
    );
    return (
      value.beforeMacroHourIndex === derived.beforeMacroHourIndex &&
      value.afterMacroHourIndex === derived.afterMacroHourIndex &&
      value.crossed === derived.crossed
    );
  } catch {
    return false;
  }
}

export function deriveGameCalendar(absoluteTick: number): GameCalendar {
  assertAbsoluteTick(absoluteTick);
  const completeDays = Math.floor(absoluteTick / HOURS_PER_DAY);
  const hour = absoluteTick % HOURS_PER_DAY;
  const completeMonths = Math.floor(completeDays / DAYS_PER_MONTH);
  return Object.freeze({
    year: Math.floor(completeMonths / MONTHS_PER_YEAR) + 1,
    month: (completeMonths % MONTHS_PER_YEAR) + 1,
    day: (completeDays % DAYS_PER_MONTH) + 1,
    hour,
  });
}

export function deriveGameCalendarFromGameMinute(gameMinute: AbsoluteGameMinute): GameCalendar {
  return deriveGameCalendar(macroHourValue(deriveMacroHourIndex(gameMinute)));
}

export function isDevelopmentEvaluationTick(absoluteTick: number): boolean {
  const hour = deriveGameCalendar(absoluteTick).hour;
  return DEVELOPMENT_EVALUATION_HOURS.some((candidate) => candidate === hour);
}
