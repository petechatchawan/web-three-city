import {
  compareMacroHours,
  HOURS_PER_DAY,
  MONTHS_PER_YEAR,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { RciContractError } from '../contracts/errors.js';

declare const ageOriginMacroHourBrand: unique symbol;

/**
 * A citizen's birth origin may predate the simulation epoch. It is therefore
 * signed, unlike the non-negative absolute MacroHourIndex owned by
 * simulation-core.
 */
export type AgeOriginMacroHourIndex = number & {
  readonly [ageOriginMacroHourBrand]: 'AgeOriginMacroHourIndex';
};

export function ageOriginMacroHour(value: number): AgeOriginMacroHourIndex {
  if (!Number.isSafeInteger(value)) {
    throw new RciContractError('rci:invalid-state');
  }
  return value as AgeOriginMacroHourIndex;
}

export function ageOriginMacroHourValue(value: AgeOriginMacroHourIndex | MacroHourIndex): number {
  if (!Number.isSafeInteger(value)) {
    throw new RciContractError('rci:invalid-state');
  }
  return value;
}

export function compareAgeOrigins(
  first: AgeOriginMacroHourIndex | MacroHourIndex,
  second: AgeOriginMacroHourIndex | MacroHourIndex,
): -1 | 0 | 1 {
  const firstValue = ageOriginMacroHourValue(first);
  const secondValue = ageOriginMacroHourValue(second);
  return firstValue < secondValue ? -1 : firstValue > secondValue ? 1 : 0;
}

export const RCI_CYCLES_PER_CALENDAR_YEAR = MONTHS_PER_YEAR;
export const RCI_MACRO_HOURS_PER_SIMULATION_CYCLE = HOURS_PER_DAY;
export const RCI_MACRO_HOURS_PER_CALENDAR_YEAR =
  RCI_CYCLES_PER_CALENDAR_YEAR * RCI_MACRO_HOURS_PER_SIMULATION_CYCLE;

export const RCI_DAILY_LIFECYCLE_HOUR = 8;

export type AgeBandDefinitionId =
  'age-band.early-childhood' | 'age-band.school-age' | 'age-band.working-age' | 'age-band.senior';

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

export function ageYearsAtMacroHour(
  bornAt: AgeOriginMacroHourIndex | MacroHourIndex,
  now: MacroHourIndex,
): number {
  return ageYearsFromMacroHourValues(ageOriginMacroHourValue(bornAt), checkedMacroHourValue(now));
}

export function ageBandAtMacroHour(
  bornAt: AgeOriginMacroHourIndex | MacroHourIndex,
  now: MacroHourIndex,
): AgeBandDefinitionId {
  return ageBandForYears(ageYearsAtMacroHour(bornAt, now));
}

export function ageOriginForYearsAtMacroHour(
  now: MacroHourIndex,
  years: number,
): AgeOriginMacroHourIndex {
  const nowValue = checkedMacroHourValue(now);
  if (!Number.isSafeInteger(years) || years < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  const origin = BigInt(nowValue) - BigInt(years) * BigInt(RCI_MACRO_HOURS_PER_CALENDAR_YEAR);
  if (origin < BigInt(Number.MIN_SAFE_INTEGER) || origin > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RciContractError('rci:invalid-state');
  }
  return ageOriginMacroHour(Number(origin));
}

export function isPopulationLifecycleCycle(
  beforeMacroHourIndex: MacroHourIndex,
  afterMacroHourIndex: MacroHourIndex,
): boolean {
  const before = checkedMacroHourValue(beforeMacroHourIndex);
  const after = checkedMacroHourValue(afterMacroHourIndex);
  if (compareMacroHours(afterMacroHourIndex, beforeMacroHourIndex) <= 0) return false;

  const firstBoundary =
    before < RCI_DAILY_LIFECYCLE_HOUR
      ? RCI_DAILY_LIFECYCLE_HOUR
      : RCI_DAILY_LIFECYCLE_HOUR +
        (Math.floor((before - RCI_DAILY_LIFECYCLE_HOUR) / RCI_MACRO_HOURS_PER_SIMULATION_CYCLE) +
          1) *
          RCI_MACRO_HOURS_PER_SIMULATION_CYCLE;
  return firstBoundary <= after;
}
