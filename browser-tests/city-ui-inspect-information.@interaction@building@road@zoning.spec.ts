import { closeBuild, openInformationViews, waitForCityUi } from './helpers/city-ui.js';
import { expect, test, type Page } from '@playwright/test';
import {
  CENTER_BUILDING_FIXTURE,
  pointFor,
  prepareSingleBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import {
  GAME_URL,
  clickGameMenuAction,
  locateTerrainCell,
  readEvidence,
} from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

async function expandInspect(page: Page): Promise<ReturnType<Page['getByTestId']>> {
  const inspect = page.getByTestId('inspect-surface');
  await expect(inspect).toBeVisible();
  if ((await inspect.getAttribute('data-expanded')) !== 'true') {
    await inspect.getByRole('button', { name: 'Expand Inspect', exact: true }).click();
  }
  await expect(inspect).toHaveAttribute('data-expanded', 'true');
  return inspect;
}

async function closeInspect(page: Page): Promise<void> {
  const inspect = page.getByTestId('inspect-surface');
  await inspect.getByRole('button', { name: 'Close Inspect', exact: true }).click();
  await expect(inspect).toBeHidden();
}

test('inspects terrain and replaces then deactivates the primary information view', async ({
  page,
}) => {
  await openGame(page);
  const terrainCell = { x: 64, z: 64 };
  const terrainPoint = await locateTerrainCell(page, terrainCell);
  await page.mouse.click(terrainPoint.x, terrainPoint.y);
  let inspect = page.getByTestId('inspect-surface');
  await expect(inspect.locator('.city-inspect-title')).toHaveText('Terrain');
  await expect(inspect).toContainText(`Cell: ${terrainCell.x}, ${terrainCell.z}`);
  inspect = await expandInspect(page);
  await expect(inspect).toContainText('Water');
  await closeInspect(page);

  await openInformationViews(page);
  await page.getByRole('button', { name: 'Canonical Grid' }).click();
  await expect(page.getByTestId('information-view-legend')).toContainText('Canonical Grid');
  expect((await readEvidence(page)).gridVisible).toBe(true);

  await page.getByRole('button', { name: 'Zoning', exact: true }).click();
  await expect(page.getByTestId('information-view-legend')).toContainText('Zoning');
  expect((await readEvidence(page)).gridVisible).toBe(false);

  await page.getByRole('button', { name: 'Deactivate view' }).click();
  await expect(page.getByTestId('information-view-legend')).toHaveCount(0);
  expect((await readEvidence(page)).gridVisible).toBe(false);
});

test('uses Building over Zone and inspects Road and remaining Zone cells', async ({ page }) => {
  await openGame(page);
  await prepareDeterministicGrowthClock(page);
  const points = await prepareSingleBuildingFixtureWorld(page, CENTER_BUILDING_FIXTURE);

  await closeBuild(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tool-context-toggle')).toHaveCount(0);

  const roadCell = CENTER_BUILDING_FIXTURE.roadCells[0];
  const roadPoint = pointFor(points, roadCell);
  await page.mouse.click(roadPoint.x, roadPoint.y);
  let inspect = page.getByTestId('inspect-surface');
  await expect(inspect.locator('.city-inspect-title')).toHaveText('Basic Road');
  await expect(inspect).toContainText(`Cell: ${roadCell.x}, ${roadCell.z}`);
  await closeInspect(page);

  const zoneCell = CENTER_BUILDING_FIXTURE.zoneCells[0];
  const zonePoint = pointFor(points, zoneCell);
  await page.mouse.click(zonePoint.x, zonePoint.y);
  inspect = page.getByTestId('inspect-surface');
  await expect(inspect.locator('.city-inspect-title')).toHaveText('Residential Zone');
  inspect = await expandInspect(page);
  await expect(inspect).toContainText('Development');
  await expect(inspect).toContainText('Open');
  await closeInspect(page);

  const snapshot = await stepLogicalTicks(page, 16);
  expect(snapshot.buildingCount).toBeGreaterThanOrEqual(1);

  await clickGameMenuAction(page, 'Save world');
  const instances = await page.evaluate(() => {
    const raw = localStorage.getItem('web-three-city:world-save:v7');
    const save = JSON.parse(raw ?? '{}') as {
      buildings?: { instances?: Array<{ originCell: { x: number; z: number } }> };
    };
    return save.buildings?.instances ?? [];
  });
  const buildingCell = instances[0]?.originCell;
  if (buildingCell === undefined) throw new Error('inspect:missing-building-fixture');

  await page.mouse.click(pointFor(points, buildingCell).x, pointFor(points, buildingCell).y);
  inspect = await expandInspect(page);
  await expect(inspect).toContainText('Capacity');
  await expect(inspect).toContainText('Road access');
  await expect(inspect).toContainText('Yes');
});
