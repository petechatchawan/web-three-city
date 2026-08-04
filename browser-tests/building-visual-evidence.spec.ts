import { expect, test } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test('captures deterministic Residential, Commercial, and Industrial prototypes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  const points = await prepareBuildingFixtureWorld(page);

  await page.getByRole('button', { name: 'Develop Zones' }).click();
  const trigger = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[0]);
  await page.mouse.click(trigger.x, trigger.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zones developed');

  const evidence = await readEvidence(page);
  expect(evidence.building.definitionIds).toEqual([
    'commercial-office-2x2',
    'industrial-factory-2x2',
    'residential-apartment-2x2',
  ]);
  await page.screenshot({
    path: testInfo.outputPath('building-foundation-rci-prototypes.png'),
    fullPage: true,
  });
});
