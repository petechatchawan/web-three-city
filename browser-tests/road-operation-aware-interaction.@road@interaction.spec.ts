import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  ROAD_PLACEMENT_ENVIRONMENT,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  planRoadMutation,
  type CellCoord,
} from './helpers/domain-fixtures.js';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import {
  GAME_URL,
  clickTerrainCell,
  dispatchCanvasTouch,
  readEvidence,
} from './helpers/interaction.js';

function findLine(): readonly CellCoord[] {
  const empty = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (let z = 6; z < WORLD_CONFIG.mapHeight - 6; z += 1) {
    for (let x = 6; x < WORLD_CONFIG.mapWidth - 10; x += 1) {
      const cells = Object.freeze([
        Object.freeze({ x, z }),
        Object.freeze({ x: x + 1, z }),
        Object.freeze({ x: x + 2, z }),
        Object.freeze({ x: x + 3, z }),
      ]);
      const plan = planRoadMutation(
        empty,
        { operation: 'build', definitionId: 'basic-road', cells },
        ROAD_PLACEMENT_ENVIRONMENT,
        WORLD_CONFIG,
      );
      if (plan.valid) return cells;
    }
  }
  throw new Error('operation-aware:no-valid-line');
}

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

async function attachViewport(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test('Road operations expose distinct Preview and release outside Terrain commits the latest plan', async ({
  page,
}, testInfo) => {
  await openGame(page);
  const cells = findLine();
  const points = [];
  for (const cell of cells) points.push(await clickTerrainCell(page, cell));

  await openBuildCategory(page, 'roads');
  const buildRoad = page.getByRole('button', { name: 'Build Road' });
  await buildRoad.click();
  await dispatchCanvasTouch(page, 'pointerdown', 1, points[0]!.x, points[0]!.y);
  await dispatchCanvasTouch(page, 'pointermove', 1, points.at(-1)!.x, points.at(-1)!.y);
  let evidence = await readEvidence(page);
  expect(evidence.road.previewValid).toBe(true);
  expect(evidence.road.previewCellCount).toBe(cells.length);
  await expect(buildRoad).toHaveAttribute('aria-pressed', 'true');
  await attachViewport(page, testInfo, 'valid-build-preview');
  await dispatchCanvasTouch(page, 'pointerup', 1, 20, 450);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(cells.length);

  await dispatchCanvasTouch(page, 'pointerdown', 2, points[0]!.x, points[0]!.y);
  evidence = await readEvidence(page);
  expect(evidence.road.previewValid).toBe(false);
  expect(evidence.road.invalidMarkerCount).toBe(1);
  await attachViewport(page, testInfo, 'invalid-build-preview');
  await dispatchCanvasTouch(page, 'pointerup', 2, points[0]!.x, points[0]!.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road unchanged');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(cells.length);

  await openBuildCategory(page, 'roads');
  const bulldozeRoad = page.getByRole('button', { name: 'Bulldoze Road' });
  await bulldozeRoad.click();
  await dispatchCanvasTouch(page, 'pointerdown', 3, points[0]!.x, points[0]!.y);
  await dispatchCanvasTouch(page, 'pointermove', 3, points.at(-1)!.x, points.at(-1)!.y);
  evidence = await readEvidence(page);
  expect(evidence.road.previewValid).toBe(true);
  expect(evidence.road.bulldozeMarkerCount).toBe(1);
  await expect(bulldozeRoad).toHaveAttribute('aria-pressed', 'true');
  await attachViewport(page, testInfo, 'valid-bulldoze-preview');
  await dispatchCanvasTouch(page, 'pointerup', 3, points.at(-1)!.x, points.at(-1)!.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road bulldozed');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(0);
});
