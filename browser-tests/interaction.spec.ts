import { expect, test } from '@playwright/test';
import {
  dispatchCanvasPointer,
  dispatchCanvasTouch,
  GAME_URL,
  readEvidence,
} from './helpers/interaction.js';

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

test('pinch zooms without selection', async ({ page }) => {
  await openGame(page);
  const before = await readEvidence(page);
  await dispatchCanvasTouch(page, 'pointerdown', 11, 800, 500);
  await dispatchCanvasTouch(page, 'pointerdown', 12, 1000, 500);
  await dispatchCanvasTouch(page, 'pointermove', 11, 760, 500);
  await dispatchCanvasTouch(page, 'pointermove', 12, 1040, 500);
  await dispatchCanvasTouch(page, 'pointerup', 11, 760, 500);
  await dispatchCanvasTouch(page, 'pointerup', 12, 1040, 500);

  const after = await readEvidence(page);
  expect(after.camera.orthographicSize).toBeLessThan(before.camera.orthographicSize);
  expect(after.selectedCell).toBeNull();
});

test('twist produces continuous yaw without selection', async ({ page }) => {
  await openGame(page);
  const before = await readEvidence(page);
  await dispatchCanvasTouch(page, 'pointerdown', 21, 820, 500);
  await dispatchCanvasTouch(page, 'pointerdown', 22, 980, 500);
  await dispatchCanvasTouch(page, 'pointermove', 21, 830, 460);
  await dispatchCanvasTouch(page, 'pointermove', 22, 970, 540);
  await dispatchCanvasTouch(page, 'pointerup', 21, 830, 460);
  await dispatchCanvasTouch(page, 'pointerup', 22, 970, 540);

  const after = await readEvidence(page);
  expect(after.camera.yawDegrees).not.toBe(before.camera.yawDegrees);
  expect(after.selectedCell).toBeNull();
});

test('parallel upward drag increases pitch within limits', async ({ page }) => {
  await openGame(page);
  const before = await readEvidence(page);
  await dispatchCanvasTouch(page, 'pointerdown', 31, 850, 520);
  await dispatchCanvasTouch(page, 'pointerdown', 32, 950, 520);
  for (const y of [510, 500, 490, 480]) {
    await dispatchCanvasTouch(page, 'pointermove', 31, 850, y);
    await dispatchCanvasTouch(page, 'pointermove', 32, 950, y);
  }
  await dispatchCanvasTouch(page, 'pointerup', 31, 850, 480);
  await dispatchCanvasTouch(page, 'pointerup', 32, 950, 480);

  const after = await readEvidence(page);
  expect(after.camera.pitchDegrees).toBeGreaterThan(before.camera.pitchDegrees);
  expect(after.camera.pitchDegrees).toBeLessThanOrEqual(70);
  expect(after.selectedCell).toBeNull();
});

test('third contact suppresses until all contacts release', async ({ page }) => {
  await openGame(page);
  await dispatchCanvasTouch(page, 'pointerdown', 41, 780, 500);
  await dispatchCanvasTouch(page, 'pointerdown', 42, 900, 500);
  await dispatchCanvasTouch(page, 'pointerdown', 43, 1020, 500);
  await dispatchCanvasTouch(page, 'pointermove', 41, 700, 500);
  await dispatchCanvasTouch(page, 'pointermove', 42, 900, 450);
  await dispatchCanvasTouch(page, 'pointermove', 43, 1100, 500);
  await dispatchCanvasTouch(page, 'pointerup', 41, 700, 500);
  await dispatchCanvasTouch(page, 'pointerup', 42, 900, 450);
  await dispatchCanvasTouch(page, 'pointerup', 43, 1100, 500);

  expect((await readEvidence(page)).selectedCell).toBeNull();
});

test('pointer cancellation cannot select', async ({ page }) => {
  await openGame(page);
  await dispatchCanvasPointer(page, 'pointerdown', 51, 900, 500);
  await dispatchCanvasPointer(page, 'pointercancel', 51, 900, 500);
  expect((await readEvidence(page)).selectedCell).toBeNull();
});

test('a pointer starting on UI never moves the world', async ({ page }) => {
  await openGame(page);
  const before = await readEvidence(page);
  const grid = page.getByRole('button', { name: 'Grid' });
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y + 100);
  await page.mouse.up();
  const after = await readEvidence(page);
  expect(after.camera).toEqual(before.camera);
});

test('context loss clears an active session before release', async ({ page }) => {
  await openGame(page);
  await dispatchCanvasPointer(page, 'pointerdown', 61, 900, 500);
  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
  });
  await dispatchCanvasPointer(page, 'pointerup', 61, 900, 500);

  expect((await readEvidence(page)).activePointerCount).toBe(0);
});

test('reset after resize uses the new usable viewport', async ({ page }) => {
  await openGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Reset camera' }).click();

  const evidence = await readEvidence(page);
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
  await expect(page.getByTestId('controls-mode')).toHaveText('compact');
});

test('context restore preserves grid and selection with one root each', async ({ page }) => {
  await openGame(page);
  await page.mouse.click(900, 500);
  await expect(page.getByTestId('selected-cell')).not.toHaveText('None');
  await page.getByRole('button', { name: 'Grid' }).click();

  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Ready');

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
