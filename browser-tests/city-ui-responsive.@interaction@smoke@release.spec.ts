import { expect, test } from '@playwright/test';
import { closeBuild, openBuildCategory, openGameMenu } from './helpers/city-ui.js';
import { GAME_URL } from './helpers/interaction.js';

const viewports = [
  { width: 414, height: 896, canonical: true },
  { width: 390, height: 844, canonical: false },
  { width: 844, height: 390, canonical: false },
  { width: 932, height: 430, canonical: false },
  { width: 1280, height: 720, canonical: false },
  { width: 1440, height: 900, canonical: false },
] as const;

for (const viewport of viewports) {
  test(`renders the City UI shell without overflow at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(GAME_URL);
    await expect(page.locator('.city-awareness-hud')).toBeVisible();
    await expect(page.locator('.city-bottom-nav')).toBeVisible();
    for (const category of ['terrain', 'roads', 'zones', 'buildings', 'city'] as const) {
      await expect(page.getByTestId(`nav-${category}`)).toBeVisible();
    }
    await expect(page.getByTestId('build-cta')).toHaveCount(0);
    await expect(page.getByTestId('primary-navigate')).toHaveCount(0);
    await expect(page.getByTestId('build-category-dock')).toHaveCount(0);
    await expect(page.getByTestId('subtool-tray')).toBeHidden();
    await expect(page.locator('.city-status-feedback')).toBeHidden();
    await expect(page.locator('[data-simulation-speed]')).toHaveCount(4);

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

    if (viewport.canonical) {
      await openBuildCategory(page, 'terrain');
      await expect(page.getByRole('button', { name: 'Raise', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Brush 1 × 1' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Brush 5 × 5' })).toBeVisible();
      await expect(page.getByTestId('tool-context-toggle')).toBeVisible();
      await closeBuild(page);
      await expect(page.getByTestId('subtool-tray')).toBeHidden();
    }

    await openGameMenu(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save world' })).toBeVisible();
  });
}
