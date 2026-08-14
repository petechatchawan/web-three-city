import { expect, test } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { prepareDeterministicGrowthClock, readTimeSnapshot } from './helpers/growth-fixture.js';
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
  const removeButton = page.getByRole('button', { name: 'Remove Zone' });
  await removeButton.click();
  await expect(removeButton).toHaveAttribute('aria-pressed', 'true');
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

  await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TIME__?: {
          setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;
        };
      }
    ).__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('growth-reservation:missing-time-api');
    api.setSpeed('faster');
  });
  await expect
    .poll(async () => (await readTimeSnapshot(page)).simulation.absoluteTick, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TIME__?: {
          setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;
        };
      }
    ).__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('growth-reservation:missing-time-api');
    api.setSpeed('paused');
  });

  await expect(removeButton).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Zone removed');
  await expect(page.getByTestId('tool-context-status')).not.toHaveText('Building rejected');
  await expect(page.getByTestId('tool-context-status')).not.toHaveText('Zone blocked by building');
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Zoning', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Residential zones2');
  await expect(removeButton).toHaveAttribute('aria-pressed', 'true');
});
