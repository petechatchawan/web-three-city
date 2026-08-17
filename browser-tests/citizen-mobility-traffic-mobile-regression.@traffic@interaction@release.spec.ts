import { expect, test } from '@playwright/test';
import { openBuildCategory } from './helpers/city-ui.js';

const viewports = [
  { width: 414, height: 896, name: 'canonical portrait' },
  { width: 390, height: 844, name: 'secondary portrait' },
  { width: 844, height: 390, name: 'landscape' },
] as const;

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
  await expect(page.locator('.city-tool-context-name')).toHaveText('Build Road');
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
  await expect(page.locator('.city-tool-context-name')).toHaveText('Build Road');

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
