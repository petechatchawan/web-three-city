import { expect, test } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL } from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

test('active Zone removal commits after background Growth skips its reserved cells', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
  const points = await prepareBuildingFixtureWorld(page);

  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: 'Remove Zone' }).click();
  await expect(page.getByTestId('build-picker')).toBeHidden();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Remove Zone');
  const start = pointFor(points, BUILDING_FIXTURES.residential.zoneCells[0]);
  const end = pointFor(points, BUILDING_FIXTURES.residential.zoneCells[1]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await expect
    .poll(() =>
      page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.zone.strokeActive ?? false),
    )
    .toBe(true);

  // This test owns Growth reservation semantics, not real-time clock throughput.
  // Keep the stroke active while advancing the exact logical ticks deterministically;
  // x4 wall-clock behavior is covered separately by the time controls/manual visual gate.
  const afterGrowth = await stepLogicalTicks(page, 4);
  expect(afterGrowth.simulation.absoluteTick).toBe(12);
  expect(afterGrowth.speed).toBe('paused');

  await expect(page.locator('.city-tool-context-name')).toHaveText('Remove Zone');
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Zone removed');
  await expect(page.getByTestId('tool-context-status')).not.toHaveText('Building rejected');
  await expect(page.getByTestId('tool-context-status')).not.toHaveText('Zone blocked by building');
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Zoning', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Residential zones2');
  await expect(page.locator('.city-tool-context-name')).toHaveText('Remove Zone');
});
