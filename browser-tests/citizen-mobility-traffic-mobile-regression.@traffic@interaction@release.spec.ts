import { expect, test } from '@playwright/test';
import { openBuildCategory } from './helpers/city-ui.js';

const viewports = [
  { width: 414, height: 896, name: 'canonical portrait' },
  { width: 390, height: 844, name: 'secondary portrait' },
  { width: 844, height: 390, name: 'compact landscape' },
  { width: 896, height: 414, name: 'rotated landscape' },
  { width: 1024, height: 600, name: 'tablet landscape' },
  { width: 1280, height: 720, name: 'desktop landscape' },
] as const;

const landscapeViewports = new Set([
  'compact landscape',
  'rotated landscape',
  'tablet landscape',
  'desktop landscape',
]);

for (const viewport of viewports) {
  test(`${viewport.name}: Traffic UI preserves mobile shell bounds`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByTestId('nav-build')).toBeVisible();
    await expect(page.getByTestId('nav-city')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByTestId('nav-city').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialogBox = await page.getByRole('dialog').boundingBox();
    expect(dialogBox).not.toBeNull();
    if (dialogBox !== null) {
      expect(dialogBox.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    if (landscapeViewports.has(viewport.name)) {
      const hud = page.locator('.city-awareness-hud.city-mobile-hud');
      const city = page.locator('[data-metric-group="city-values"]');
      const time = page.locator('[data-metric="gameTime"]');
      const demand = page.locator('[data-metric="demand"]');
      const controls = page.locator('.city-simulation-controls');
      const step = page.locator('[data-simulation-step]');
      await expect(hud).toHaveCSS('display', 'grid');
      await expect(time.locator('.city-mobile-hud-value--time')).toBeVisible();
      await expect(step).toBeVisible();
      const cityBox = await city.boundingBox();
      const timeBox = await time.boundingBox();
      const demandBox = await demand.boundingBox();
      const controlsBox = await controls.boundingBox();
      const stepBox = await step.boundingBox();
      expect(cityBox).not.toBeNull();
      expect(timeBox).not.toBeNull();
      expect(demandBox).not.toBeNull();
      expect(controlsBox).not.toBeNull();
      expect(stepBox).not.toBeNull();
      if (
        cityBox !== null &&
        timeBox !== null &&
        demandBox !== null &&
        controlsBox !== null &&
        stepBox !== null
      ) {
        expect(cityBox.width).toBeLessThanOrEqual(Math.min(560, viewport.width * 0.7));
        expect(timeBox.width).toBeGreaterThanOrEqual(144);
        expect(demandBox.height).toBeGreaterThanOrEqual(72);
        expect(timeBox.x + timeBox.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(demandBox.x + demandBox.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(stepBox.y).toBeGreaterThanOrEqual(controlsBox.y - 1);
        expect(stepBox.y + stepBox.height).toBeLessThanOrEqual(
          controlsBox.y + controlsBox.height + 1,
        );
      }

      const gridTemplateColumns = await hud.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns,
      );
      expect(gridTemplateColumns).not.toBe('none');

      const demandRows = demand.locator('[data-rci-demand-bar]');
      await expect(demandRows).toHaveCount(3);
      const rowBoxes = await demandRows.evaluateAll((rows) =>
        rows.map((row) => {
          const box = row.getBoundingClientRect();
          return { height: box.height, top: box.top };
        }),
      );
      expect(rowBoxes.every((row) => row.height >= 16)).toBe(true);
      expect(rowBoxes[0]!.top).toBeLessThan(rowBoxes[1]!.top);
      expect(rowBoxes[1]!.top).toBeLessThan(rowBoxes[2]!.top);
    }
  });
}

test('Traffic information view does not synthesize Navigate, clear active tool, or mutate speed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as Window & { __WEB_THREE_CITY_TIME__?: unknown }).__WEB_THREE_CITY_TIME__),
      ),
    )
    .toBe(true);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road', exact: true }).click();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Local Street');
  const beforeSpeed = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TIME__?: { snapshot(): { speed: string } };
      }
    ).__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('time test API unavailable');
    return api.snapshot().speed;
  });

  await page.getByTestId('nav-city').click();
  await page.getByRole('button', { name: /Information Views/i }).click();
  await page.locator('[data-information-view="traffic"]').click();
  await expect(page.locator('[data-testid="information-view-legend"]')).toContainText('Traffic');
  await expect(page.locator('.city-tool-context-name')).toHaveText('Local Street');

  const afterSpeed = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TIME__?: { snapshot(): { speed: string } };
      }
    ).__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('time test API unavailable');
    return api.snapshot().speed;
  });
  expect(afterSpeed).toBe(beforeSpeed);
});
