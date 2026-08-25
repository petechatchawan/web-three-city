import { expect, test } from '@playwright/test';
import { waitForCityUi } from './helpers/city-ui.js';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v8';

async function waitForReady(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

async function openTaxation(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Economy', exact: true }).click();
  await page.getByRole('button', { name: 'Taxation', exact: true }).click();
}

async function closeDialog(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
}

test('shows the compact municipal budget without changing world tools', async ({ page }) => {
  await waitForReady(page);
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Economy', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Treasury100,000.00');
  await expect(dialog).toContainText('Income0.00');
  await expect(dialog).toContainText('Expenses0.00');
  await expect(dialog).toContainText('Net0.00');
  await expect(page.getByTestId('build-category-dock')).toHaveCount(0);
  await expect(page.getByTestId('build-picker')).toBeHidden();
});

test('applies typed tax policy and round-trips the committed Economy save', async ({ page }) => {
  await waitForReady(page);
  await openTaxation(page);
  let dialog = page.getByRole('dialog');
  await dialog.getByTestId('tax-residential').selectOption('8');
  await dialog.getByTestId('apply-tax-policy').click();
  await expect(dialog.getByRole('status')).toHaveText('Tax policy updated');

  await closeDialog(page);
  await clickGameMenuAction(page, 'Save world');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    schemaVersion: 8,
    economy: {
      schemaVersion: 1,
      taxPolicy: { residentialBp: 800 },
    },
  });

  await openTaxation(page);
  dialog = page.getByRole('dialog');
  await dialog.getByTestId('tax-residential').selectOption('7');
  await dialog.getByTestId('apply-tax-policy').click();
  await closeDialog(page);
  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('tool-context-status')).toHaveText('Loaded');
  await openTaxation(page);
  await expect(page.getByRole('dialog').getByTestId('tax-residential')).toHaveValue('8');
});
