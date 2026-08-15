import { expect, test } from '@playwright/test';

test.describe('Citizen Mobility & Traffic Foundation v0.1', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await page.goto('/');
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            (window as Window & {
              __TRAFFIC_WORLD__?: () => unknown;
              __TRAFFIC_DEBUG__?: () => unknown;
            }).__TRAFFIC_WORLD__,
          ),
        ),
      )
      .toBe(true);
  });

  test('exposes committed Mobility/Traffic debug state without changing the frozen shell', async ({
    page,
  }) => {
    const state = await page.evaluate(() => {
      const app = window as Window & {
        __TRAFFIC_WORLD__?: () => {
          mobilityRevision: number;
          trafficRevision: number;
          activeMobilityTrips: number;
          activeTransportTrips: number;
        };
        __TRAFFIC_DEBUG__?: () => {
          visiblePedestrians: number;
          visibleVehicles: number;
        } | null;
      };
      return Object.freeze({ world: app.__TRAFFIC_WORLD__?.(), visual: app.__TRAFFIC_DEBUG__?.() });
    });
    expect(state.world).toBeTruthy();
    expect(state.world?.activeMobilityTrips).toBeGreaterThanOrEqual(0);
    expect(state.world?.activeTransportTrips).toBeGreaterThanOrEqual(0);
    expect(state.visual).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Build' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'City' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });

  test('registers Traffic as the single active information view and supports Thai copy', async ({ page }) => {
    await page.getByRole('button', { name: 'City' }).click();
    const informationEntry = page.getByRole('button', { name: /Information Views/i });
    await expect(informationEntry).toBeVisible();
    await informationEntry.click();
    const traffic = page.locator('[data-information-view="traffic"]');
    await expect(traffic).toBeVisible();
    await traffic.click();
    await expect(page.locator('[data-testid="information-view-legend"]')).toContainText('Traffic');

    await page.getByRole('button', { name: /City|เมือง/ }).click();
    const thai = page.locator('[data-testid="locale-th"]');
    await expect(thai).toBeVisible();
    await thai.click();
    await expect(page.getByRole('button', { name: 'เมือง' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('opening presentation surfaces does not mutate Mobility/Traffic authority', async ({ page }) => {
    const before = await page.evaluate(() =>
      (window as Window & { __TRAFFIC_WORLD__?: () => unknown }).__TRAFFIC_WORLD__?.(),
    );
    await page.getByRole('button', { name: 'City' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Build' }).click();
    await page.keyboard.press('Escape');
    const after = await page.evaluate(() =>
      (window as Window & { __TRAFFIC_WORLD__?: () => unknown }).__TRAFFIC_WORLD__?.(),
    );
    expect(after).toEqual(before);
  });
});
