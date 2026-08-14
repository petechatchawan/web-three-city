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

async function clickCameraMenuAction(
  page: Page,
  name: 'Rotate right' | 'Reset camera',
): Promise<void> {
  const activeDialog = page.getByRole('dialog');
  if (await activeDialog.isVisible()) {
    await activeDialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Game Menu', exact: true }).click();
  const action = page.getByRole('dialog').getByRole('button', { name, exact: true });
  await expect(action).toBeAttached();
  await action.evaluate((button) => (button as HTMLButtonElement).click());
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

test('camera pan remains screen-relative after every quarter-turn rotation', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await openGame(page);
  for (let turns = 0; turns < 4; turns += 1) {
    await clickCameraMenuAction(page, 'Reset camera');
    for (let index = 0; index < turns; index += 1)
      await clickCameraMenuAction(page, 'Rotate right');
    const beforeRight = (await readEvidence(page)).camera;
    await page.mouse.move(900, 500);
    await page.mouse.down();
    await page.mouse.move(980, 500, { steps: 6 });
    await page.mouse.up();
    const afterRight = (await readEvidence(page)).camera;
    const yaw = (beforeRight.yawDegrees * Math.PI) / 180;
    const deltaX = afterRight.targetX - beforeRight.targetX;
    const deltaZ = afterRight.targetZ - beforeRight.targetZ;
    const expectedX = -Math.cos(yaw);
    const expectedZ = Math.sin(yaw);
    expect(deltaX * expectedX + deltaZ * expectedZ).toBeGreaterThan(0);
    expect(Math.abs(deltaX * expectedZ - deltaZ * expectedX)).toBeLessThan(0.01);

    await clickCameraMenuAction(page, 'Reset camera');
    for (let index = 0; index < turns; index += 1)
      await clickCameraMenuAction(page, 'Rotate right');
    const beforeUp = (await readEvidence(page)).camera;
    await page.mouse.move(900, 550);
    await page.mouse.down();
    await page.mouse.move(900, 470, { steps: 6 });
    await page.mouse.up();
    const afterUp = (await readEvidence(page)).camera;
    const upDeltaX = afterUp.targetX - beforeUp.targetX;
    const upDeltaZ = afterUp.targetZ - beforeUp.targetZ;
    const expectedUpX = Math.sin(yaw);
    const expectedUpZ = Math.cos(yaw);
    expect(upDeltaX * expectedUpX + upDeltaZ * expectedUpZ).toBeGreaterThan(0);
    expect(Math.abs(upDeltaX * expectedUpZ - upDeltaZ * expectedUpX)).toBeLessThan(0.01);
  }
  await attachViewport(page, testInfo, 'camera-pan-after-rotations');
});
