import { expect, test } from '@playwright/test';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:terrain-save:v1';

async function waitForReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

test('desktop and mobile initial views fit the whole world', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForReady(page);
  let evidence = await readEvidence(page);
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
  expect(evidence.framingMarginRatio).toBe(0.08);
  await expect(page.getByTestId('controls-mode')).toHaveText('expanded');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await expect(page.getByTestId('controls-mode')).toHaveText('compact');
  evidence = await readEvidence(page);
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
});

test('drag pans without selecting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForReady(page);

  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();

  const evidence = await readEvidence(page);
  expect(evidence.camera.targetX === 0 && evidence.camera.targetZ === 0).toBe(false);
  expect(evidence.selectedCell).toBeNull();
});

test('tap selects, grid toggles, and reset restores defaults', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForReady(page);

  await page.mouse.click(900, 500);
  let evidence = await readEvidence(page);
  expect(evidence.selectedCell).not.toBeNull();
  await expect(page.getByTestId('selected-cell')).not.toHaveText('None');

  const gridButton = page.getByRole('button', { name: 'Grid' });
  await expect(gridButton).toHaveAttribute('aria-pressed', 'false');
  await gridButton.click();
  evidence = await readEvidence(page);
  expect(evidence.gridVisible).toBe(true);
  await expect(gridButton).toHaveAttribute('aria-pressed', 'true');

  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Rotate right' }).click();
  await page.getByRole('button', { name: 'Reset camera' }).click();

  evidence = await readEvidence(page);
  expect(evidence.camera).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
});

test('changes quality and round-trips terrain save data', async ({ page }) => {
  await waitForReady(page);

  await page.getByRole('button', { name: 'Save terrain' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(saved).not.toBeNull();

  await page.getByLabel('Quality').selectOption('low');
  await expect(page.getByTestId('quality-value')).toHaveText('Low');

  await page.getByRole('button', { name: 'Load terrain' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
});

test('recovers presentation state after WebGL context loss', async ({ page }) => {
  await waitForReady(page);
  const canvas = page.locator('#game-canvas');

  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Context lost');

  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
});
