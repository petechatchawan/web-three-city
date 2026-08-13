import { expect, test } from '@playwright/test';
import {
  GAME_URL,
  clickGameMenuAction,
  dispatchCanvasTouch,
  dispatchTouchOn,
  readEvidence,
} from './helpers/interaction.js';

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
}

test('pinch zooms without selection', async ({ page }) => {
  await openGame(page);
  const before = (await readEvidence(page)).camera.orthographicSize;

  await dispatchCanvasTouch(page, 'pointerdown', 1, 700, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 900, 400);
  await dispatchCanvasTouch(page, 'pointermove', 1, 680, 400);
  await dispatchCanvasTouch(page, 'pointermove', 2, 920, 400);
  await dispatchCanvasTouch(page, 'pointermove', 1, 660, 400);
  await dispatchCanvasTouch(page, 'pointermove', 2, 940, 400);
  await dispatchCanvasTouch(page, 'pointerup', 1, 660, 400);
  await dispatchCanvasTouch(page, 'pointerup', 2, 940, 400);

  const after = await readEvidence(page);
  expect(after.camera.orthographicSize).toBeLessThan(before);
  expect(after.selectedCell).toBeNull();
  expect(after.activePointerCount).toBe(0);
});

test('twist produces continuous yaw without selection', async ({ page }) => {
  await openGame(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, 700, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 900, 400);
  await dispatchCanvasTouch(page, 'pointermove', 1, 710, 380);
  await dispatchCanvasTouch(page, 'pointermove', 2, 890, 420);
  await dispatchCanvasTouch(page, 'pointermove', 1, 725, 365);
  await dispatchCanvasTouch(page, 'pointermove', 2, 875, 435);
  await dispatchCanvasTouch(page, 'pointerup', 1, 725, 365);
  await dispatchCanvasTouch(page, 'pointerup', 2, 875, 435);

  const evidence = await readEvidence(page);
  expect(evidence.camera.yawDegrees % 90).not.toBeCloseTo(0);
  expect(evidence.selectedCell).toBeNull();
});

test('parallel upward drag increases pitch within limits', async ({ page }) => {
  await openGame(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, 700, 450);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 900, 450);
  await dispatchCanvasTouch(page, 'pointermove', 1, 700, 430);
  await dispatchCanvasTouch(page, 'pointermove', 2, 900, 430);
  await dispatchCanvasTouch(page, 'pointermove', 1, 700, 410);
  await dispatchCanvasTouch(page, 'pointermove', 2, 900, 410);
  await dispatchCanvasTouch(page, 'pointerup', 1, 700, 410);
  await dispatchCanvasTouch(page, 'pointerup', 2, 900, 410);

  const evidence = await readEvidence(page);
  expect(evidence.camera.pitchDegrees).toBeGreaterThan(50);
  expect(evidence.camera.pitchDegrees).toBeLessThanOrEqual(65);
  expect(evidence.selectedCell).toBeNull();
});

test('third contact suppresses until all contacts release', async ({ page }) => {
  await openGame(page);
  const before = (await readEvidence(page)).camera;

  await dispatchCanvasTouch(page, 'pointerdown', 1, 700, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 900, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 3, 800, 500);
  await dispatchCanvasTouch(page, 'pointermove', 1, 650, 400);
  await dispatchCanvasTouch(page, 'pointerup', 3, 800, 500);
  await dispatchCanvasTouch(page, 'pointermove', 2, 950, 400);
  await dispatchCanvasTouch(page, 'pointerup', 1, 650, 400);
  await dispatchCanvasTouch(page, 'pointerup', 2, 950, 400);

  const evidence = await readEvidence(page);
  expect(evidence.camera).toEqual(before);
  expect(evidence.selectedCell).toBeNull();
  expect(evidence.activePointerCount).toBe(0);
});

test('pointer cancellation cannot select', async ({ page }) => {
  await openGame(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, 800, 400);
  await dispatchCanvasTouch(page, 'pointercancel', 1, 800, 400);

  const evidence = await readEvidence(page);
  expect(evidence.selectedCell).toBeNull();
  expect(evidence.activePointerCount).toBe(0);
});

test('a pointer starting on UI never moves the world', async ({ page }) => {
  await openGame(page);
  const before = (await readEvidence(page)).camera;
  await page.getByRole('button', { name: 'Game Menu', exact: true }).click();
  const saveButton = page.getByRole('dialog').getByRole('button', { name: 'Save world' });
  const box = await saveButton.boundingBox();
  if (box === null) throw new Error('missing Save terrain bounds');

  await dispatchTouchOn(saveButton, 'pointerdown', 1, box.x + 5, box.y + 5);
  await dispatchTouchOn(saveButton, 'pointermove', 1, box.x + 80, box.y + 40);
  await dispatchTouchOn(saveButton, 'pointerup', 1, box.x + 80, box.y + 40);

  const evidence = await readEvidence(page);
  expect(evidence.camera).toEqual(before);
  expect(evidence.selectedCell).toBeNull();
  expect(evidence.activePointerCount).toBe(0);
});

test('context loss clears an active session before release', async ({ page }) => {
  await openGame(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, 800, 400);
  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.getByTestId('tool-context-status')).toHaveText('Context lost');
  await dispatchCanvasTouch(page, 'pointerup', 1, 800, 400);

  const evidence = await readEvidence(page);
  expect(evidence.activePointerCount).toBe(0);
  expect(evidence.selectedCell).toBeNull();
});

test('reset after resize uses the new usable viewport', async ({ page }) => {
  await openGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await clickGameMenuAction(page, 'Reset camera');

  const evidence = await readEvidence(page);
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
});

test('context restore preserves grid and selection with one root each', async ({ page }) => {
  await openGame(page);
  await page.mouse.click(900, 500);
  await expect(page.getByRole('dialog')).toBeVisible();
  await clickGameMenuAction(page, 'Grid');

  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');

  const evidence = await readEvidence(page);
  expect(evidence.gridVisible).toBe(true);
  expect(evidence.selectedCell).not.toBeNull();
  expect(evidence.sceneRootCounts).toEqual({
    terrain: 1,
    water: 1,
    grid: 1,
    selection: 1,
    preview: 0,
    roadCommitted: 1,
    roadPreview: 0,
    zoneCommitted: 1,
    zonePreview: 0,
    buildingCommitted: 1,
  });
});
