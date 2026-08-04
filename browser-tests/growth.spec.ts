import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import {
  prepareDeterministicGrowthClock,
  readTimeSnapshot,
  stepLogicalTicks,
} from './helpers/growth-fixture.js';
import { GAME_URL } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v3';

async function openGrowthGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await prepareDeterministicGrowthClock(page);
}

test('exposes the simple calendar and deterministic time controls', async ({ page }) => {
  await openGrowthGame(page);
  await expect(page.getByTestId('game-calendar')).toHaveText('Y1 M1 D1 08:00');
  await expect(page.getByRole('button', { name: 'Pause simulation' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Normal simulation speed' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Fast simulation speed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Faster simulation speed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advance exactly one hour' })).toBeEnabled();

  const after = await stepLogicalTicks(page, 1);
  expect(after.simulation.absoluteTick).toBe(9);
  expect(after.speed).toBe('paused');
  await expect(page.getByTestId('game-calendar')).toHaveText('Y1 M1 D1 09:00');
});

test('starts at most one automatic Construction per evaluation tick', async ({ page }) => {
  await openGrowthGame(page);
  await prepareBuildingFixtureWorld(page);

  let snapshot = await stepLogicalTicks(page, 4);
  expect(snapshot.simulation.absoluteTick).toBe(12);
  expect(snapshot.simulation.growthSequence).toBe(1);
  expect(snapshot.buildingCount).toBe(1);
  await expect(page.getByTestId('building-construction-count')).toHaveText('1');
  await expect(page.getByTestId('building-active-count')).toHaveText('0');

  snapshot = await stepLogicalTicks(page, 6);
  expect(snapshot.simulation.absoluteTick).toBe(18);
  expect(snapshot.simulation.growthSequence).toBe(2);
  expect(snapshot.buildingCount).toBe(2);
  await expect(page.getByTestId('building-construction-count')).toHaveText('2');
});

test('persists WorldSaveV4 and loads paused at the exact logical tick', async ({ page }) => {
  await openGrowthGame(page);
  await prepareBuildingFixtureWorld(page);
  await stepLogicalTicks(page, 4);

  await page.getByRole('button', { name: 'Save world' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const parsed = JSON.parse(saved ?? '{}') as {
    readonly schemaVersion?: number;
    readonly simulation?: { readonly absoluteTick?: number; readonly growthSequence?: number };
    readonly buildings?: { readonly schemaVersion?: number };
  };
  expect(parsed.schemaVersion).toBe(4);
  expect(parsed.simulation).toMatchObject({ absoluteTick: 12, growthSequence: 1 });
  expect(parsed.buildings?.schemaVersion).toBe(2);

  await stepLogicalTicks(page, 3);
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  const loaded = await readTimeSnapshot(page);
  expect(loaded.simulation.absoluteTick).toBe(12);
  expect(loaded.simulation.growthSequence).toBe(1);
  expect(loaded.speed).toBe('paused');
});

test('does not expose the explicit Develop Zones control in production Growth mode', async ({
  page,
}) => {
  await openGrowthGame(page);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
});
