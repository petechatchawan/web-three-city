import { expect, type Page } from '@playwright/test';

interface TimeSnapshot {
  readonly revision: number;
  readonly simulation: Readonly<{
    readonly revision: number;
    readonly absoluteGameMinute: number;
    readonly absoluteTick: number;
    readonly growthSequence: number;
  }>;
  readonly speed: 'paused' | 'normal' | 'fast' | 'faster';
  readonly buildingCount: number;
}

export async function prepareDeterministicGrowthClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: {
        setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;
        setAutomaticGrowthEnabled?(enabled: boolean): void;
        resetForTest?(): void;
        stepMinutes?(count: number): boolean;
      };
    };
    timeWindow.__WEB_THREE_CITY_TIME__?.setAutomaticGrowthEnabled?.(true);
    timeWindow.__WEB_THREE_CITY_TIME__?.resetForTest?.();
    timeWindow.__WEB_THREE_CITY_TIME__?.setSpeed('paused');
  });
  await expect(page.locator('[data-simulation-speed="paused"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-simulation-step]')).toBeVisible();
}

export async function readTimeSnapshot(page: Page): Promise<TimeSnapshot> {
  return page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: { snapshot(): TimeSnapshot };
    };
    const snapshot = timeWindow.__WEB_THREE_CITY_TIME__?.snapshot();
    if (snapshot === undefined) throw new Error('growth:missing-time-api');
    return {
      ...snapshot,
      revision: snapshot.revision,
      simulation: {
        ...snapshot.simulation,
        absoluteTick: Math.floor(snapshot.simulation.absoluteGameMinute / 60),
      },
    };
  });
}

export async function stepLogicalTicks(page: Page, count: number): Promise<TimeSnapshot> {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('growth:invalid-step-count');
  return stepLogicalMinutes(page, count * 60);
}

export async function stepLogicalMinutes(page: Page, count: number): Promise<TimeSnapshot> {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('growth:invalid-step-count');
  await page.evaluate((minutes) => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: { step(): boolean; stepMinutes?(count: number): boolean };
    };
    const api = timeWindow.__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('growth:missing-time-api');
    if (api.stepMinutes !== undefined) {
      if (!api.stepMinutes(minutes)) throw new Error('growth:step-rejected');
      return;
    }
    for (let minute = 0; minute < minutes; minute += 1) {
      if (!api.step()) throw new Error('growth:step-rejected');
    }
  }, count);
  return readTimeSnapshot(page);
}
