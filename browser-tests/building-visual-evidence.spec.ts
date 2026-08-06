import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

const EXPECTED_DEFINITION_IDS = Object.freeze([
  'commercial-cafe-1x1',
  'commercial-shop-1x1',
  'industrial-depot-1x1',
  'residential-cottage-1x1',
]);

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
  expect(snapshot.buildingCount).toBe(4);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);

  const evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(4);
  expect(evidence.building.occupiedCellCount).toBe(4);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  await page.screenshot({
    path: testInfo.outputPath('building-foundation-rci-prototypes.png'),
    fullPage: true,
  });
});
