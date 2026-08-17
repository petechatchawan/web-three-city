import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import {
  ROAD_PLACEMENT_ENVIRONMENT,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  planRoadMutation,
} from './helpers/domain-fixtures.js';
import { GAME_URL, TERRAIN_LAB_URL, locateTerrainCell, readEvidence } from './helpers/interaction.js';

async function captureFixture(
  page: Page,
  testInfo: TestInfo,
  fixture: string,
  fileName: string,
): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
  await page.screenshot({ path: testInfo.outputPath(fileName), fullPage: true });
}

function findBuildableRoadCell(): Readonly<{ x: number; z: number }> {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  const centerX = Math.floor(WORLD_CONFIG.mapWidth / 2);
  const centerZ = Math.floor(WORLD_CONFIG.mapHeight / 2);
  const cells: Array<Readonly<{ x: number; z: number }>> = [];
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 8; x += 1) cells.push({ x, z });
  }
  cells.sort(
    (first, second) =>
      (first.x - centerX) ** 2 +
        (first.z - centerZ) ** 2 -
        ((second.x - centerX) ** 2 + (second.z - centerZ) ** 2) ||
      first.z - second.z ||
      first.x - second.x,
  );
  for (const cell of cells) {
    const plan = planRoadMutation(
      roads,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      ROAD_PLACEMENT_ENVIRONMENT,
      WORLD_CONFIG,
    );
    if (plan.valid) return cell;
  }
  throw new Error('road-visual:no-buildable-cell');
}

test('captures Road topology overview', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'road-four-way', 'road-topology-four-way.png');
});

test('captures both-axis Ramp alignment', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'road-ramp-north-up', 'road-ramp-north-south.png');
  await captureFixture(page, testInfo, 'road-ramp-east-up', 'road-ramp-east-west.png');
});

test('captures invalid Preview feedback', async ({ page }, testInfo) => {
  await captureFixture(
    page,
    testInfo,
    'road-invalid-ramp-perpendicular',
    'road-invalid-ramp-preview.png',
  );
  await captureFixture(page, testInfo, 'road-invalid-wet', 'road-invalid-wet-preview.png');
});

test('captures cross-chunk Road continuity', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'road-chunk-boundary', 'road-chunk-boundary.png');
});

test('captures the canonical mobile Game Road Build context', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road', exact: true }).click();
  await expect(page.getByTestId('build-picker')).toBeHidden();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Local Street');
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: testInfo.outputPath('road-game-mobile.png'), fullPage: true });
});

test('replaces Local Street with Collector and Arterial without duplicating occupancy', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  const cell = findBuildableRoadCell();
  const point = await locateTerrainCell(page, cell);
  const before = await readEvidence(page);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road', exact: true }).click();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Local Street');
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  const local = await readEvidence(page);
  expect(local.road.committedRoadRevision).toBe(before.road.committedRoadRevision + 1);
  expect(local.road.occupiedCellCount).toBe(before.road.occupiedCellCount + 1);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Collector Road', exact: true }).click();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Collector Road');
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  const collector = await readEvidence(page);
  expect(collector.road.committedRoadRevision).toBe(local.road.committedRoadRevision + 1);
  expect(collector.road.occupiedCellCount).toBe(local.road.occupiedCellCount);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Arterial Road', exact: true }).click();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Arterial Road');
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  const arterial = await readEvidence(page);
  expect(arterial.road.committedRoadRevision).toBe(collector.road.committedRoadRevision + 1);
  expect(arterial.road.occupiedCellCount).toBe(local.road.occupiedCellCount);

  await page.screenshot({ path: testInfo.outputPath('road-type-replacement-mobile.png'), fullPage: true });
});
