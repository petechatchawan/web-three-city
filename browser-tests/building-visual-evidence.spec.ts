import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test('captures deterministic Residential, Commercial, and Industrial prototypes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await prepareDeterministicGrowthClock(page);
  await prepareBuildingFixtureWorld(page);

  const snapshot = await stepLogicalTicks(page, 40);
  expect(snapshot.simulation.absoluteTick).toBe(48);
  expect(snapshot.buildingCount).toBe(3);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);

  const evidence = await readEvidence(page);
  expect(evidence.building.definitionIds).toEqual([
    'commercial-office-2x2',
    'industrial-warehouse-2x2',
    'residential-apartment-2x2',
  ]);
  await page.screenshot({
    path: testInfo.outputPath('building-foundation-rci-prototypes.png'),
    fullPage: true,
  });
});
