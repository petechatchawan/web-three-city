import { expect, test, type Page } from '@playwright/test';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v6';

async function waitForReady(page: Page): Promise<void> {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
}

function metric(page: Page, key: string) {
  return page.locator(`[data-metric="${key}"] strong`);
}

async function readCityDialog(page: Page): Promise<{
  population: string;
  households: string;
  housing: string;
  employment: string;
}> {
  await page.getByRole('button', { name: 'City', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // City overview rows render as <p><span>label</span><strong>value</strong></p>;
  // read the strong value for each labelled row instead of parsing joined text.
  const valueOf = async (label: string): Promise<string> => {
    const row = dialog.locator('p').filter({ hasText: label });
    await expect(row).toHaveCount(1);
    const value = await row.locator('strong').textContent();
    if (value === null) throw new Error(`rci:missing-value:${label}`);
    return value;
  };
  const result = {
    population: await valueOf('Population'),
    households: await valueOf('Households'),
    housing: await valueOf('Housing'),
    employment: await valueOf('Employment'),
  };
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  return result;
}

test('shows compact RCI statistics without changing the default tool', async ({ page }) => {
  await waitForReady(page);
  await expect(metric(page, 'population')).toHaveText('0');
  await expect(metric(page, 'demand')).toHaveText('R→ C→ I→');
  await expect(page.getByTestId('tool-context-name')).toHaveText('Navigate');

  await page.getByRole('button', { name: 'City', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Households0');
  await expect(dialog).toContainText('Housing0/0');
  await expect(dialog).toContainText('Employment0/0');
});

test('background RCI ticks do not interrupt an active zoning tool', async ({ page }) => {
  await waitForReady(page);
  await page.getByTestId('nav-zones').click();
  await page.getByRole('button', { name: 'Residential', exact: true }).click();
  await expect(page.getByTestId('tool-context-name')).toHaveText('Residential Zone');
  await page.waitForTimeout(1_500);
  await expect(page.getByTestId('tool-context-name')).toHaveText('Residential Zone');
});

test('round-trips WorldSaveV6 with RCI, Economy, and restores HUD values', async ({ page }) => {
  await waitForReady(page);
  const before = await readCityDialog(page);
  await expect(metric(page, 'population')).toHaveText(before.population);

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
  await expect(page.getByTestId('tool-context-status')).toHaveText('Loaded');
  const after = await readCityDialog(page);
  expect(after).toEqual(before);
  await expect(metric(page, 'population')).toHaveText(before.population);
});
