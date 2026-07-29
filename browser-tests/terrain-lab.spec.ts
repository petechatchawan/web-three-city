import { expect, test } from '@playwright/test';
import { ROAD_FIXTURE_IDS } from '../apps/terrain-lab/src/fixture-registry.js';

const TERRAIN_LAB_URL = 'http://127.0.0.1:4173/';

test('boots the Coastal fixture without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${TERRAIN_LAB_URL}?fixture=coastal`);

  await expect(page.getByTestId('fixture-name')).toHaveText('CoastalFixture');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
  expect(errors).toEqual([]);
});

test('selects Shape Atlas, rotates, and picks a cell', async ({ page }) => {
  await page.goto(`${TERRAIN_LAB_URL}?fixture=shape-atlas`);

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
    await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
    await expect(page.getByTestId('fixture-name')).toHaveText(fixture);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
    await expect(page.getByTestId('water-status')).toHaveText('Ready');
    const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_WATER_EVIDENCE__);
    expect(evidence?.fixture).toBe(fixture);
    expect(evidence?.waterRootCount).toBe(1);
  });
}

test('keeps the enclosed basin dry and connects the open channel', async ({ page }) => {
  await page.goto(`${TERRAIN_LAB_URL}?fixture=water-enclosed-basin`);
  const enclosed = await page.evaluate(() => window.__WEB_THREE_CITY_WATER_EVIDENCE__);
  expect(enclosed?.seaTriangleCount).toBe(0);
  expect(enclosed?.enclosedWetTriangleCount).toBeGreaterThan(0);

  await page.goto(`${TERRAIN_LAB_URL}?fixture=water-open-channel`);
  const connected = await page.evaluate(() => window.__WEB_THREE_CITY_WATER_EVIDENCE__);
  expect(connected?.seaTriangleCount).toBeGreaterThan(0);
  expect(connected?.enclosedWetTriangleCount).toBe(0);
});

test('registers every Road fixture exactly once and keeps legacy fixtures available', async ({ page }) => {
  expect(ROAD_FIXTURE_IDS).toHaveLength(24);
  expect(new Set(ROAD_FIXTURE_IDS).size).toBe(ROAD_FIXTURE_IDS.length);

  for (const fixture of [ROAD_FIXTURE_IDS[0], ROAD_FIXTURE_IDS.at(-1)] as const) {
    await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
    await expect(page.getByTestId('fixture-name')).toHaveText(fixture!);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
    await expect(page.getByTestId('road-status')).not.toHaveText('None');
  }

  await page.goto(`${TERRAIN_LAB_URL}?fixture=coastal`);
  await expect(page.getByTestId('fixture-name')).toHaveText('CoastalFixture');
  await page.goto(`${TERRAIN_LAB_URL}?fixture=water-straight-coast`);
  await expect(page.getByTestId('fixture-name')).toHaveText('water-straight-coast');
});
