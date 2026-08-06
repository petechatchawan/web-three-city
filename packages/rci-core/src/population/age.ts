import { RciContractError } from '../contracts/errors.js';

export const RCI_TICKS_PER_DAY = 24;
export const RCI_DAYS_PER_YEAR = 360;
export const RCI_TICKS_PER_YEAR = RCI_TICKS_PER_DAY * RCI_DAYS_PER_YEAR;
export const RCI_DAILY_LIFECYCLE_HOUR = 8;

export type AgeBandDefinitionId =
  'age-band.early-childhood' | 'age-band.school-age' | 'age-band.working-age' | 'age-band.senior';

function assertSafeTick(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RciContractError('rci:invalid-state');
  }
}

export function ageYearsAtTick(bornAtTick: number, absoluteTick: number): number {
  assertSafeTick(bornAtTick);
  assertSafeTick(absoluteTick);
  const elapsed = absoluteTick - bornAtTick;
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  return Math.floor(elapsed / RCI_TICKS_PER_YEAR);
}

export function ageBandAtTick(bornAtTick: number, absoluteTick: number): AgeBandDefinitionId {
  const age = ageYearsAtTick(bornAtTick, absoluteTick);
  if (age < 6) return 'age-band.early-childhood';
  if (age < 18) return 'age-band.school-age';
  if (age < 65) return 'age-band.working-age';
  return 'age-band.senior';
}

export function isDailyLifecycleTick(beforeTick: number, afterTick: number): boolean {
  assertSafeTick(beforeTick);
  assertSafeTick(afterTick);
  if (afterTick <= beforeTick) return false;

  const firstBoundary =
    beforeTick < RCI_DAILY_LIFECYCLE_HOUR
      ? RCI_DAILY_LIFECYCLE_HOUR
      : RCI_DAILY_LIFECYCLE_HOUR +
        (Math.floor((beforeTick - RCI_DAILY_LIFECYCLE_HOUR) / RCI_TICKS_PER_DAY) + 1) *
          RCI_TICKS_PER_DAY;
  return firstBoundary <= afterTick;
}
