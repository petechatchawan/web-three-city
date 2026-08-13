import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL } from './helpers/interaction.js';

// Hosted Chromium visual capture has a measured ~66s floor on current runners.
test.describe.configure({ timeout: 90_000 });

test('captures Construction phases, variety, and responsive time controls', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
  await prepareDeterministicGrowthClock(page);
  await prepareBuildingFixtureWorld(page);

  await stepLogicalTicks(page, 4);
  await expect(page.locator('[data-metric="construction"] strong')).toHaveText('1');
  await page.screenshot({
    path: testInfo.outputPath('growth-foundation-desktop.png'),
    fullPage: true,
  });

  await stepLogicalTicks(page, 32);
  await page.screenshot({
    path: testInfo.outputPath('growth-frame-and-variety-desktop.png'),
    fullPage: true,
  });

  await stepLogicalTicks(page, 32);
  await page.screenshot({
    path: testInfo.outputPath('growth-shell-and-variety-desktop.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-simulation-speed]')).toHaveText('Ⅱ');
  await expect(page.locator('[data-simulation-step]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('growth-time-controls-mobile.png'),
    fullPage: true,
  });
});
