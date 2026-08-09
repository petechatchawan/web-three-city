import { expect, test } from '@playwright/test';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v6';

async function waitForReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

test('shows compact RCI statistics without changing the default tool', async ({ page }) => {
  await waitForReady(page);
  await expect(page.getByTestId('rci-population')).toHaveText('0');
  await expect(page.getByTestId('rci-households')).toHaveText('0');
  await expect(page.getByTestId('rci-housing')).toHaveText('0/0');
  await expect(page.getByTestId('rci-employment')).toHaveText('0/0');
  await expect(page.getByTestId('rci-demand-residential')).toContainText('closed');
  await expect(page.getByTestId('rci-demand-commercial')).toContainText('closed');
  await expect(page.getByTestId('rci-demand-industrial')).toContainText('closed');
  await expect(page.getByTestId('active-tool')).toHaveText('Navigate');
});

test('background RCI ticks do not interrupt an active zoning tool', async ({ page }) => {
  await waitForReady(page);
  await page.getByRole('button', { name: 'Residential' }).click();
  await expect(page.getByTestId('active-tool')).toHaveText('Residential Zone');
  await page.waitForTimeout(1_500);
  await expect(page.getByTestId('active-tool')).toHaveText('Residential Zone');
  await expect(page.getByRole('button', { name: 'Residential' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('round-trips WorldSaveV6 with RCI, Economy, and restores HUD values', async ({ page }) => {
  await waitForReady(page);
  const before = {
    population: await page.getByTestId('rci-population').textContent(),
    households: await page.getByTestId('rci-households').textContent(),
    housing: await page.getByTestId('rci-housing').textContent(),
    employment: await page.getByTestId('rci-employment').textContent(),
  };

  await clickGameMenuAction(page, 'Save world');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    kind: 'world-save',
    schemaVersion: 6,
    simulation: { schemaVersion: 2 },
    buildings: { schemaVersion: 2 },
    rci: { kind: 'rci-save', schemaVersion: 1 },
    economy: { schemaVersion: 1 },
  });

  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  await expect(page.getByTestId('rci-population')).toHaveText(before.population ?? '');
  await expect(page.getByTestId('rci-households')).toHaveText(before.households ?? '');
  await expect(page.getByTestId('rci-housing')).toHaveText(before.housing ?? '');
  await expect(page.getByTestId('rci-employment')).toHaveText(before.employment ?? '');
});
