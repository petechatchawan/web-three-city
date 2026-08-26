import {
  HOURS_PER_DAY,
  MONTHS_PER_YEAR,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { RciContractError } from '../contracts/errors.js';

export const RCI_CYCLES_PER_CALENDAR_YEAR = MONTHS_PER_YEAR;
export const RCI_MACRO_HOURS_PER_SIMULATION_CYCLE = HOURS_PER_DAY;
export const RCI_MACRO_HOURS_PER_CALENDAR_YEAR =
  RCI_CYCLES_PER_CALENDAR_YEAR * RCI_MACRO_HOURS_PER_SIMULATION_CYCLE;

/** @deprecated Use RCI_MACRO_HOURS_PER_SIMULATION_CYCLE. */
export const RCI_TICKS_PER_DAY = RCI_MACRO_HOURS_PER_SIMULATION_CYCLE;
/** @deprecated Use RCI_CYCLES_PER_CALENDAR_YEAR. */
export const RCI_DAYS_PER_YEAR = RCI_CYCLES_PER_CALENDAR_YEAR;
/** @deprecated Use RCI_MACRO_HOURS_PER_CALENDAR_YEAR. */
export const RCI_TICKS_PER_YEAR = RCI_MACRO_HOURS_PER_CALENDAR_YEAR;
export const RCI_DAILY_LIFECYCLE_HOUR = 8;

export type AgeBandDefinitionId =
  'age-band.early-childhood' | 'age-band.school-age' | 'age-band.working-age' | 'age-band.senior';

function assertSafeLegacyMacroHour(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RciContractError('rci:invalid-state');
  }
}

function checkedMacroHourValue(value: MacroHourIndex): number {
  const scalar = macroHourValue(value);
  if (!Number.isSafeInteger(scalar) || scalar < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  return scalar;
}

function ageYearsFromMacroHourValues(bornAt: number, now: number): number {
  const elapsed = now - bornAt;
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  return Math.floor(elapsed / RCI_MACRO_HOURS_PER_CALENDAR_YEAR);
}

function ageBandForYears(age: number): AgeBandDefinitionId {
  if (age < 6) return 'age-band.early-childhood';
  if (age < 18) return 'age-band.school-age';
  if (age < 65) return 'age-band.working-age';
  return 'age-band.senior';
}

export function ageYearsAtMacroHour(bornAt: MacroHourIndex, now: MacroHourIndex): number {
  return ageYearsFromMacroHourValues(checkedMacroHourValue(bornAt), checkedMacroHourValue(now));
}

export function ageBandAtMacroHour(
  bornAt: MacroHourIndex,
  now: MacroHourIndex,
): AgeBandDefinitionId {
  return ageBandForYears(ageYearsAtMacroHour(bornAt, now));
}

/** @deprecated Use ageYearsAtMacroHour with explicit temporal values. */
export function ageYearsAtTick(bornAtTick: number, absoluteTick: number): number {
  assertSafeLegacyMacroHour(bornAtTick);
  assertSafeLegacyMacroHour(absoluteTick);
  return ageYearsFromMacroHourValues(bornAtTick, absoluteTick);
}

/** @deprecated Use ageBandAtMacroHour with explicit temporal values. */
export function ageBandAtTick(bornAtTick: number, absoluteTick: number): AgeBandDefinitionId {
  return ageBandForYears(ageYearsAtTick(bornAtTick, absoluteTick));
}

export function isDailyLifecycleTick(beforeTick: number, afterTick: number): boolean {
  assertSafeLegacyMacroHour(beforeTick);
  assertSafeLegacyMacroHour(afterTick);
  if (afterTick <= beforeTick) return false;

  const firstBoundary =
    beforeTick < RCI_DAILY_LIFECYCLE_HOUR
      ? RCI_DAILY_LIFECYCLE_HOUR
      : RCI_DAILY_LIFECYCLE_HOUR +
        (Math.floor(
          (beforeTick - RCI_DAILY_LIFECYCLE_HOUR) / RCI_MACRO_HOURS_PER_SIMULATION_CYCLE,
        ) +
          1) *
          RCI_MACRO_HOURS_PER_SIMULATION_CYCLE;
  return firstBoundary <= afterTick;
}
