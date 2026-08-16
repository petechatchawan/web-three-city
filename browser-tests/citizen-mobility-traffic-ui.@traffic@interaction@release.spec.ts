import { expect, test } from '@playwright/test';

type TrafficApiSnapshot = {
  worldRevision: number;
  absoluteTick: number;
  citizenIds: string[];
  mobility: unknown;
  traffic: unknown;
  presentation: {
    visiblePedestrians: number;
    visibleVehicles: number;
    journeyReplayCount: number;
  } | null;
};

async function trafficApiReady(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as Window & { __WEB_THREE_CITY_TRAFFIC__?: unknown }).__WEB_THREE_CITY_TRAFFIC__,
        ),
      ),
    )
    .toBe(true);
}

async function readTraffic(page: import('@playwright/test').Page): Promise<TrafficApiSnapshot> {
  return page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
}

test.describe('Citizen Mobility & Traffic Foundation v0.1', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await page.goto('/');
    await trafficApiReady(page);
  });

  test('exposes committed Mobility/Traffic debug state without changing the frozen shell', async ({
    page,
  }) => {
    const state = await readTraffic(page);
    expect(state.worldRevision).toBeGreaterThanOrEqual(0);
    expect(state.absoluteTick).toBeGreaterThanOrEqual(0);
    expect(state.mobility).toBeTruthy();
    expect(state.traffic).toBeTruthy();
    expect(state.presentation).toBeTruthy();
    await expect(page.getByTestId('nav-build')).toBeVisible();
    await expect(page.getByTestId('nav-city')).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });

  test('registers Traffic as the single active information view and supports Thai copy', async ({
    page,
  }) => {
    await page.getByTestId('nav-city').click();
    const informationEntry = page.getByRole('button', { name: /Information Views/i });
    await expect(informationEntry).toBeVisible();
    await informationEntry.click();
    const traffic = page.locator('[data-information-view="traffic"]');
    await expect(traffic).toBeVisible();
    await traffic.click();
    await expect(page.locator('[data-testid="information-view-legend"]')).toContainText('Traffic');

    await page.getByTestId('nav-city').click();
    const thai = page.locator('[data-testid="locale-th"]');
    await expect(thai).toBeVisible();
    await thai.click();
    await expect(page.getByTestId('nav-city')).toHaveAccessibleName('เมือง');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('opening presentation surfaces does not mutate Mobility/Traffic authority', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const api = (
        window as Window & {
          __WEB_THREE_CITY_TRAFFIC__?: { installReleaseFixture(): unknown };
        }
      ).__WEB_THREE_CITY_TRAFFIC__;
      if (api === undefined) throw new Error('traffic test API unavailable');
      api.installReleaseFixture();
    });
    const before = await readTraffic(page);
    await page.getByTestId('nav-city').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-build').click();
    await page.keyboard.press('Escape');
    const after = await readTraffic(page);
    expect(after.citizenIds).toEqual(before.citizenIds);
    expect(after.mobility).toEqual(before.mobility);
    expect(after.traffic).toEqual(before.traffic);
    expect(after.absoluteTick).toBe(before.absoluteTick);
  });
});
