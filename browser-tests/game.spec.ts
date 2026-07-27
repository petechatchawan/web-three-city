import { expect, test } from '@playwright/test';

const SAVE_KEY = 'web-three-city:terrain-save:v1';

test('boots, changes quality, and round-trips terrain save data', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/');

  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: 'Save terrain' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(saved).not.toBeNull();

  await page.getByLabel('Quality').selectOption('low');
  await expect(page.getByTestId('quality-value')).toHaveText('Low');

  await page.getByRole('button', { name: 'Load terrain' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
});

test('recovers presentation state after WebGL context loss', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/');
  const canvas = page.locator('canvas');

  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Context lost');

  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
});
