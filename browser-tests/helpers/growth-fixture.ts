import { expect, type Page } from '@playwright/test';

interface TimeSnapshot {
  readonly simulation: Readonly<{
    readonly revision: number;
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
    return snapshot;
  });
}

export async function stepLogicalTicks(page: Page, count: number): Promise<TimeSnapshot> {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('growth:invalid-step-count');
  await page.evaluate((ticks) => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: { step(): boolean };
    };
    const api = timeWindow.__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('growth:missing-time-api');
    for (let index = 0; index < ticks; index += 1) {
      if (!api.step()) throw new Error('growth:step-rejected');
    }
  }, count);
  return readTimeSnapshot(page);
}
