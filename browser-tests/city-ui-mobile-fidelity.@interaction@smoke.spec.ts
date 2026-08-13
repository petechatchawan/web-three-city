import { expect, test } from '@playwright/test';
import { GAME_URL } from './helpers/interaction.js';

test('keeps the primary 390×844 shell inside the viewport with separated nav and simulation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');

  const nav = page.locator('.city-bottom-nav');
  const simulation = page.locator('.city-simulation-controls');
  await expect(nav).toBeVisible();
  await expect(simulation).toBeVisible();
  await expect(nav.locator('[data-nav-category]')).toHaveCount(5);
  await expect(nav.locator('.city-simulation-controls')).toHaveCount(0);
  await expect(simulation).toHaveClass(/city-simulation-capsule/);

  const containment = await page.evaluate(() => {
    const insideViewport = (selector: string): boolean => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element === null || element.getClientRects().length === 0) return true;
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
      );
    };
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hud: insideViewport('.city-awareness-hud'),
      actions: insideViewport('.city-top-actions'),
      nav: insideViewport('.city-bottom-nav'),
      simulation: insideViewport('.city-simulation-controls'),
      context: insideViewport('.city-tool-context'),
    };
  });

  expect(containment).toEqual({
    horizontalOverflow: false,
    hud: true,
    actions: true,
    nav: true,
    simulation: true,
    context: true,
  });

  await page.getByRole('button', { name: 'Zones', exact: true }).click();
  const tray = page.locator('.city-subtool-tray');
  await expect(tray).toBeVisible();
  const trayBounds = await tray.boundingBox();
  expect(trayBounds).not.toBeNull();
  expect(trayBounds!.x).toBeGreaterThanOrEqual(0);
  expect(trayBounds!.x + trayBounds!.width).toBeLessThanOrEqual(390);
  expect(trayBounds!.y + trayBounds!.height).toBeLessThanOrEqual(844);
});
