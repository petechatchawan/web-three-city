import type { GameCalendar, MacroHourTransition } from './contracts.js';
import {
  compareMacroHours,
  gameMinuteValue,
  macroHourIndex,
  macroHourValue,
} from './temporal-units.js';
import type { AbsoluteGameMinute, MacroHourIndex } from './temporal-units.js';
import {
  GAME_MINUTES_PER_HOUR,
  HOURS_PER_SIMULATION_CYCLE,
  MINUTES_PER_SIMULATION_CYCLE,
  MONTHS_PER_CALENDAR_YEAR,
} from './calendar-policy.js';

export const HOURS_PER_DAY = HOURS_PER_SIMULATION_CYCLE;
export const MINUTES_PER_HOUR = GAME_MINUTES_PER_HOUR;
/** @deprecated T4 no longer projects calendar days. Retained for legacy callers only. */
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = MONTHS_PER_CALENDAR_YEAR;
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
    crossed: compareMacroHours(beforeMacroHourIndex, afterMacroHourIndex) !== 0,
  });
}

export function isMacroHourTransition(value: MacroHourTransition): boolean {
  try {
    const derived = deriveMacroHourTransition(
      value.beforeAbsoluteGameMinute,
      value.afterAbsoluteGameMinute,
    );
    return (
      compareMacroHours(value.beforeMacroHourIndex, derived.beforeMacroHourIndex) === 0 &&
      compareMacroHours(value.afterMacroHourIndex, derived.afterMacroHourIndex) === 0 &&
      value.crossed === derived.crossed
    );
  } catch {
    return false;
  }
}

function deriveGameCalendarValue(absoluteGameMinuteValue: number): GameCalendar {
  const completeCycles = Math.floor(absoluteGameMinuteValue / MINUTES_PER_SIMULATION_CYCLE);
  const minuteWithinCycle = absoluteGameMinuteValue % MINUTES_PER_SIMULATION_CYCLE;
  const hour = Math.floor(minuteWithinCycle / GAME_MINUTES_PER_HOUR);
  const minute = minuteWithinCycle % GAME_MINUTES_PER_HOUR;
  return Object.freeze({
    year: Math.floor(completeCycles / MONTHS_PER_CALENDAR_YEAR) + 1,
    month: (completeCycles % MONTHS_PER_CALENDAR_YEAR) + 1,
    hour,
    minute,
  });
}

/**
 * Numeric compatibility boundary for callers that have not adopted the
 * branded SimulationSnapshot contract yet. The value is still an absolute
 * GameMinute, not the legacy hourly tick.
 */
export function deriveGameCalendar(absoluteGameMinuteValue: number): GameCalendar {
  assertAbsoluteTick(absoluteGameMinuteValue);
  return deriveGameCalendarValue(absoluteGameMinuteValue);
}

export function deriveGameCalendarFromGameMinute(gameMinute: AbsoluteGameMinute): GameCalendar {
  return deriveGameCalendarValue(gameMinuteValue(gameMinute));
}

export function deriveSimulationCycleIndex(gameMinute: AbsoluteGameMinute): number {
  return Math.floor(gameMinuteValue(gameMinute) / MINUTES_PER_SIMULATION_CYCLE);
}

export function isDevelopmentEvaluationTick(absoluteMacroHourIndex: MacroHourIndex): boolean {
  const hour = macroHourValue(absoluteMacroHourIndex) % HOURS_PER_SIMULATION_CYCLE;
  return DEVELOPMENT_EVALUATION_HOURS.some((candidate) => candidate === hour);
}
