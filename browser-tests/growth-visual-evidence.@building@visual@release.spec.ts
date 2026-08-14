import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import { waitForCityUi } from './helpers/city-ui.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL } from './helpers/interaction.js';

// Hosted Chromium visual capture has a measured ~66s floor on current runners.
test.describe.configure({ timeout: 90_000 });

test('captures Construction phases, variety, and canonical mobile time controls', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
  await prepareBuildingFixtureWorld(page);

  let snapshot = await stepLogicalTicks(page, 4);
  expect(snapshot.buildingCount).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('growth-foundation-mobile.png'),
    fullPage: true,
  });

  snapshot = await stepLogicalTicks(page, 32);
  expect(snapshot.buildingCount).toBeGreaterThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath('growth-frame-and-variety-mobile.png'),
    fullPage: true,
  });

  snapshot = await stepLogicalTicks(page, 32);
  expect(snapshot.buildingCount).toBeGreaterThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath('growth-shell-and-variety-mobile.png'),
    fullPage: true,
  });

  await expect(page.locator('[data-simulation-speed]')).toHaveText('Ⅱ');
  await expect(page.locator('[data-simulation-step]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('growth-time-controls-mobile.png'),
    fullPage: true,
  });
});
