import { waitForCityUi } from './helpers/city-ui.js';
import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

// Serial CI can spend over 60s advancing the deterministic 40-tick fixture
// after earlier WebGL-heavy cases. Keep the budget local to this visual
// evidence spec; assertions, workers, and retries are unchanged.
test.describe.configure({ timeout: 120_000 });

const EXPECTED_DEFINITION_IDS = Object.freeze([
  'commercial-cafe-1x1',
  'commercial-cafe-1x1',
  'commercial-shop-1x1',
  'industrial-depot-1x1',
  'industrial-depot-1x1',
  'industrial-workshop-1x2',
  'residential-duplex-2x1',
]);

test('captures deterministic Residential, Commercial, and Industrial prototypes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
  await prepareBuildingFixtureWorld(page);

  const snapshot = await stepLogicalTicks(page, 40);
  expect(snapshot.simulation.absoluteTick).toBe(48);
  expect(snapshot.simulation.growthSequence).toBe(7);
  expect(snapshot.buildingCount).toBe(7);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);

  const evidence = await readEvidence(page);
  expect(evidence.building.committedBuildingRevision).toBe(7);
  expect(evidence.building.commitCount).toBe(7);
  expect(evidence.building.count).toBe(7);
  expect(evidence.building.occupiedCellCount).toBe(9);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  await page.screenshot({
    path: testInfo.outputPath('building-foundation-rci-prototypes.png'),
    fullPage: true,
  });
});
