import { expect, test } from '@playwright/test';
import { GAME_URL, locateTerrainCell } from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

async function openMobile(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await expect(page.locator('.city-awareness-hud')).toBeVisible();
}

test('M6.4 exposes one Build entry and closes the picker after a concrete tool is chosen', async ({
  page,
}) => {
  await openMobile(page);

  await expect(page.getByTestId('nav-build')).toBeVisible();
  await expect(page.getByTestId('nav-city')).toBeVisible();
  for (const retired of ['nav-terrain', 'nav-roads', 'nav-zones', 'nav-buildings']) {
    await expect(page.getByTestId(retired)).toHaveCount(0);
  }

  await page.getByTestId('nav-build').click();
  const picker = page.getByTestId('build-picker');
  await expect(picker).toBeVisible();
  for (const category of ['terrain', 'roads', 'zones', 'buildings']) {
    await expect(page.getByTestId(`build-category-${category}`)).toBeVisible();
  }

  await page.getByTestId('build-category-roads').click();
  await page.getByRole('button', { name: 'Build Road', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByTestId('tool-context-toggle')).toBeVisible();

  const activePoint = await locateTerrainCell(page, { x: 64, z: 64 });
  await page.mouse.click(activePoint.x, activePoint.y);
  await expect(page.getByTestId('inspect-surface')).toBeHidden();

  const contextHeight = await page
    .getByTestId('status-feedback')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(contextHeight).toBeLessThanOrEqual(72);
});

test('M6.4 Inspect is a bounded contextual surface instead of a primary dialog', async ({
  page,
}) => {
  await openMobile(page);
  const terrainCell = { x: 64, z: 64 };
  const point = await locateTerrainCell(page, terrainCell);
  await page.mouse.click(point.x, point.y);

  const inspect = page.getByTestId('inspect-surface');
  await expect(inspect).toBeVisible();
  await expect(page.locator('.city-dialog-sheet')).toHaveCount(0);

  const collapsedHeight = await inspect.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(collapsedHeight).toBeGreaterThanOrEqual(72);
  expect(collapsedHeight).toBeLessThanOrEqual(96);

  await inspect.getByRole('button', { name: 'Expand Inspect' }).click();
  await expect(inspect).toHaveAttribute('data-expanded', 'true');
  const expandedHeight = await inspect.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(expandedHeight).toBeLessThanOrEqual(896 * 0.45 + 1);
});

test('M6.4 renders explicit RCI demand bars and supports EN/TH without overflow', async ({
  page,
}) => {
  await openMobile(page);

  const bars = page.locator('[data-rci-demand-bar]');
  await expect(bars).toHaveCount(3);
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

  await page.getByTestId('nav-city').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('locale-th').click();
  await expect(page.getByTestId('nav-build')).toContainText('สร้าง');
  await expect(page.getByTestId('nav-city')).toContainText('เมือง');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
