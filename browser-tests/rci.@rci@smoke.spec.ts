import { expect, test, type Page } from '@playwright/test';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v6';

async function waitForReady(page: Page): Promise<void> {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
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
  const valueOf = async (label: string): Promise<string> => {
    const row = dialog.locator('.city-kpi-card, .city-detail-row').filter({ hasText: label });
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

test('shows compact RCI demand bars without changing the default tool', async ({ page }) => {
  await waitForReady(page);
  await expect(metric(page, 'population')).toHaveText('0');
  await expect(page.locator('[data-rci-demand-bar]')).toHaveCount(3);
  await expect(page.locator('[data-rci-demand-bar="residential"]')).toHaveAttribute(
    'aria-label',
    /Residential demand/,
  );
  await expect(page.locator('[data-rci-demand-bar="commercial"]')).toHaveAttribute(
    'aria-label',
    /Commercial demand/,
  );
  await expect(page.locator('[data-rci-demand-bar="industrial"]')).toHaveAttribute(
    'aria-label',
    /Industrial demand/,
  );
  await expect(page.getByTestId('build-category-dock')).toHaveCount(0);
  await expect(page.getByTestId('build-picker')).toBeHidden();

  await page.getByRole('button', { name: 'City', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Households0');
  await expect(dialog).toContainText('Housing0/0');
  await expect(dialog).toContainText('Employment0/0');
  await dialog.getByRole('button', { name: 'Population / RCI', exact: true }).click();
  await expect(dialog).toContainText('Residential demand');
  await expect(dialog).toContainText('Commercial demand');
  await expect(dialog).toContainText('Industrial demand');
});

test('background RCI ticks do not interrupt an active zoning tool', async ({ page }) => {
  await waitForReady(page);
  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: 'Residential', exact: true }).click();
  await expect(page.getByTestId('build-picker')).toBeHidden();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Residential');
  await page.waitForTimeout(1_500);
  await expect(page.locator('.city-tool-context-name')).toHaveText('Residential');
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
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
