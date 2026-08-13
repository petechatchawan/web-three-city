import { expect, test } from '@playwright/test';
import { GAME_URL } from './helpers/interaction.js';

const viewports = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`renders the City UI shell without a sidebar or overflow at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(GAME_URL);
    await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
    await expect(page.locator('.city-awareness-hud')).toBeVisible();
    await expect(page.locator('.city-bottom-nav')).toBeVisible();
    await expect(page.locator('.city-simulation-controls')).toBeVisible();

    const layout = await page.evaluate(() => {
      const targets = [...document.querySelectorAll<HTMLElement>('.city-ui button')]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return Math.min(rect.width, rect.height);
        });
      return {
        overflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth ||
          document.documentElement.scrollHeight > document.documentElement.clientHeight,
        minimumTarget: Math.min(...targets),
      };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.minimumTarget).toBeGreaterThanOrEqual(44);

    await page.getByRole('button', { name: 'Game Menu', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save world' })).toBeVisible();
  });
}
