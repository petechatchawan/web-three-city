import { expect, test } from '@playwright/test';
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
    await expect(page.locator('.city-primary-actions')).toBeVisible();
    await expect(page.getByTestId('build-cta')).toBeVisible();
    await expect(page.getByTestId('build-category-dock')).toBeHidden();
    await expect(page.getByTestId('subtool-tray')).toBeHidden();
    await expect(page.locator('.city-status-feedback')).toBeHidden();

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
      await page.getByTestId('build-cta').click();
      await expect(page.getByTestId('build-category-dock')).toBeVisible();
      await expect(page.getByTestId('subtool-tray')).toBeHidden();
      await page.getByTestId('build-category-terrain').click();
      await expect(page.getByTestId('subtool-tray')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Raise', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Brush 1 × 1' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Brush 5 × 5' })).toBeVisible();
      await page.getByTestId('build-close').click();
      await expect(page.getByTestId('build-category-dock')).toBeHidden();
      await expect(page.getByTestId('subtool-tray')).toBeHidden();
    }

    await page.getByRole('button', { name: 'Game Menu', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save world' })).toBeVisible();
  });
}
