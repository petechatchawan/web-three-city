import { expect, test } from '@playwright/test';

test('boots the Coastal fixture without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('http://127.0.0.1:4173/?fixture=coastal');

  await expect(page.getByTestId('fixture-name')).toHaveText('CoastalFixture');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
  expect(errors).toEqual([]);
});

test('selects Shape Atlas, rotates, and picks a cell', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?fixture=shape-atlas');

  await expect(page.getByTestId('fixture-name')).toHaveText('ShapeAtlasFixture');
  await page.getByRole('button', { name: 'Rotate right' }).click();
  await expect(page.getByTestId('camera-rotation')).toHaveText('90°');

  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) return;
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });

  await expect(page.getByTestId('selected-cell')).not.toHaveText('None');
});
