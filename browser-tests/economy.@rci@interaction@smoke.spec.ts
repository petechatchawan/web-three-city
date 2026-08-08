import { expect, test } from '@playwright/test';
import { GAME_URL } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v6';

async function waitForReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

test('shows the compact municipal budget without changing world tools', async ({ page }) => {
  await waitForReady(page);
  await expect(page.getByTestId('economy-treasury')).toHaveText('100,000.00');
  await expect(page.getByTestId('economy-income')).toHaveText('0.00');
  await expect(page.getByTestId('economy-expenses')).toHaveText('0.00');
  await expect(page.getByTestId('economy-net')).toHaveText('0.00');
  await expect(page.getByTestId('active-tool')).toHaveText('Navigate');
});

test('applies typed tax policy and round-trips the committed Economy save', async ({ page }) => {
  await waitForReady(page);
  await page.getByTestId('budget-panel').click();
  await page.getByTestId('tax-residential').selectOption('8');
  await page.getByTestId('apply-tax-policy').click();
  await expect(page.getByRole('status')).toHaveText('Tax policy updated');

  await page.getByTestId('secondary-controls').click();
  await page.getByRole('button', { name: 'Save world' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    schemaVersion: 6,
    economy: {
      schemaVersion: 1,
      taxPolicy: { residentialBp: 800 },
    },
  });

  await page.getByTestId('tax-residential').selectOption('7');
  await page.getByTestId('apply-tax-policy').click();
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  await expect(page.getByTestId('tax-residential')).toHaveValue('8');
});
