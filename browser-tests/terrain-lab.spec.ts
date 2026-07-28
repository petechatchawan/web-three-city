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

const WATER_FIXTURES = [
  'water-straight-coast',
  'water-diagonal-sw-ne',
  'water-diagonal-nw-se',
  'water-bay',
  'water-peninsula',
  'water-chunk-seam',
  'water-enclosed-basin',
  'water-open-channel',
  'water-corner-contact',
  'water-south-wall',
] as const;

for (const fixture of WATER_FIXTURES) {
  test(`renders ${fixture}`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:4173/?fixture=${fixture}`);
    await expect(page.getByTestId('fixture-name')).toHaveText(fixture);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
    await expect(page.getByTestId('water-status')).toHaveText('Ready');
    const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_WATER_EVIDENCE__);
    expect(evidence?.fixture).toBe(fixture);
    expect(evidence?.waterRootCount).toBe(1);
  });
}

test('keeps the enclosed basin dry and connects the open channel', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?fixture=water-enclosed-basin');
  const enclosed = await page.evaluate(() => window.__WEB_THREE_CITY_WATER_EVIDENCE__);
  expect(enclosed?.seaTriangleCount).toBe(0);
  expect(enclosed?.enclosedWetTriangleCount).toBeGreaterThan(0);

  await page.goto('http://127.0.0.1:4173/?fixture=water-open-channel');
  const connected = await page.evaluate(() => window.__WEB_THREE_CITY_WATER_EVIDENCE__);
  expect(connected?.seaTriangleCount).toBeGreaterThan(0);
  expect(connected?.enclosedWetTriangleCount).toBe(0);
});
