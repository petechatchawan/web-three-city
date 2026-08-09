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
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

async function closeInspect(page: Page): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('inspects terrain and replaces then deactivates the primary information view', async ({
  page,
}) => {
  await openGame(page);
  const terrainCell = { x: 64, z: 64 };
  const terrainPoint = await locateTerrainCell(page, terrainCell);
  await page.mouse.click(terrainPoint.x, terrainPoint.y);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Terrain' })).toBeVisible();
  await expect(dialog).toContainText(`Cell${terrainCell.x}, ${terrainCell.z}`);
  await expect(dialog).toContainText('Water');
  await closeInspect(page);

  await page.getByRole('button', { name: 'Information Views' }).click();
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

  await page.getByRole('button', { name: 'Navigate', exact: true }).first().click();
  const roadCell = CENTER_BUILDING_FIXTURE.roadCells[0];
  const roadPoint = pointFor(points, roadCell);
  await page.mouse.click(roadPoint.x, roadPoint.y);
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Basic Road' })).toBeVisible();
  await expect(dialog).toContainText(`Cell${roadCell.x}, ${roadCell.z}`);
  await closeInspect(page);

  const zoneCell = CENTER_BUILDING_FIXTURE.zoneCells[0];
  const zonePoint = pointFor(points, zoneCell);
  await page.mouse.click(zonePoint.x, zonePoint.y);
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Residential Zone' })).toBeVisible();
  await expect(dialog).toContainText('DevelopmentOpen');
  await closeInspect(page);

  const snapshot = await stepLogicalTicks(page, 16);
  expect(snapshot.buildingCount).toBeGreaterThanOrEqual(1);

  await clickGameMenuAction(page, 'Save world');
  const instances = await page.evaluate(() => {
    const raw = localStorage.getItem('web-three-city:world-save:v6');
    const save = JSON.parse(raw ?? '{}') as {
      buildings?: { instances?: Array<{ originCell: { x: number; z: number } }> };
    };
    return save.buildings?.instances ?? [];
  });
  const buildingCell = instances[0]?.originCell;
  if (buildingCell === undefined) throw new Error('inspect:missing-building-fixture');

  await page.mouse.click(pointFor(points, buildingCell).x, pointFor(points, buildingCell).y);
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Capacity');
  await expect(dialog).toContainText('Road accessYes');
});
