import { expect, test } from '@playwright/test';
import { GAME_URL, clickGameMenuAction, readEvidence } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v6';

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

  await clickGameMenuAction(page, 'Grid');
  evidence = await readEvidence(page);
  expect(evidence.gridVisible).toBe(true);

  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  await clickGameMenuAction(page, 'Rotate right');
  await clickGameMenuAction(page, 'Reset camera');

  evidence = await readEvidence(page);
  expect(evidence.camera).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
});

test('changes quality and round-trips world save data', async ({ page }) => {
  await waitForReady(page);

  await clickGameMenuAction(page, 'Save world');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    kind: 'world-save',
    schemaVersion: 6,
    buildings: { schemaVersion: 2 },
    rci: { kind: 'rci-save', schemaVersion: 1 },
  });

  await page.getByRole('button', { name: 'Game Menu', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Quality').selectOption('low');
  await expect(page.getByTestId('quality-value')).toHaveText('Low');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  await clickGameMenuAction(page, 'Load world');
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
  const evidence = await readEvidence(page);
  expect(evidence.sceneRootCounts.roadCommitted).toBe(1);
  expect(evidence.sceneRootCounts.roadPreview).toBe(0);
  expect(evidence.sceneRootCounts.zoneCommitted).toBe(1);
  expect(evidence.sceneRootCounts.zonePreview).toBe(0);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('boots Coastal Water and Roads with one presentation root each', async ({ page }) => {
  await waitForReady(page);
  const evidence = await readEvidence(page);
  expect(evidence.water.waterRootCount).toBe(1);
  expect(evidence.water.seaTriangleCount).toBeGreaterThan(0);
  expect(evidence.water.sourceTerrainRevision).toBeGreaterThanOrEqual(0);
  expect(evidence.sceneRootCounts.water).toBe(1);
  expect(evidence.road.committedRootCount).toBe(1);
  expect(evidence.road.previewRootCount).toBe(0);
  expect(evidence.road.occupiedCellCount).toBe(0);
});

test('save and load reproduce identical Water evidence', async ({ page }) => {
  await waitForReady(page);
  const before = (await readEvidence(page)).water;
  await clickGameMenuAction(page, 'Save world');
  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  const after = (await readEvidence(page)).water;
  expect(after.sourceTerrainRevision).toBe(before.sourceTerrainRevision);
  expect(after.seaTriangleCount).toBe(before.seaTriangleCount);
  expect(after.enclosedWetTriangleCount).toBe(before.enclosedWetTriangleCount);
  expect(after.shorelineSegmentCount).toBe(before.shorelineSegmentCount);
  expect(after.surfaceTriangleCount).toBe(before.surfaceTriangleCount);
  expect(after.shorelineTriangleCount).toBe(before.shorelineTriangleCount);
  expect(after.wallSegmentCount).toBe(before.wallSegmentCount);
  expect(after.estimatedGeometryBytes).toBe(before.estimatedGeometryBytes);
  expect(after.waterRootCount).toBe(1);
});

test('restores exactly one Water, Road, Zone, and Building root after context restoration', async ({
  page,
}) => {
  await waitForReady(page);
  const canvas = page.locator('#game-canvas');
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    element.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  const evidence = await readEvidence(page);
  expect(evidence.water.waterRootCount).toBe(1);
  expect(evidence.sceneRootCounts.water).toBe(1);
  expect(evidence.sceneRootCounts.roadCommitted).toBe(1);
  expect(evidence.sceneRootCounts.roadPreview).toBe(0);
  expect(evidence.sceneRootCounts.zoneCommitted).toBe(1);
  expect(evidence.sceneRootCounts.zonePreview).toBe(0);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('exposes Terraform, Road, Zone, and Building tools with mode-aware brush controls', async ({
  page,
}) => {
  await waitForReady(page);

  await expect(page.getByRole('button', { name: 'Navigate' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const name of [
    'Raise',
    'Lower',
    'Flatten',
    'Build Road',
    'Bulldoze Road',
    'Residential',
    'Commercial',
    'Industrial',
    'Remove Zone',
    'Bulldoze Building',
  ]) {
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await expect(page.getByTestId('terraform-brush-controls')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Undo latest world change' })).toBeDisabled();
  await expect(page.getByTestId('active-tool')).toHaveText('Navigate');

  await page.getByRole('button', { name: 'Build Road' }).click();
  await expect(page.getByRole('button', { name: 'Build Road' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('active-tool')).toHaveText('Build Road');
  await expect(page.getByTestId('terraform-brush-controls')).toBeHidden();

  await page.getByRole('button', { name: 'Residential' }).click();
  await expect(page.getByTestId('active-tool')).toHaveText('Residential Zone');
  await expect(page.getByTestId('terraform-brush-controls')).toBeHidden();

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await expect(page.getByTestId('active-tool')).toHaveText('Bulldoze Building');
  await expect(page.getByTestId('terraform-brush-controls')).toBeHidden();

  await page.getByRole('button', { name: 'Raise' }).click();
  await expect(page.getByRole('button', { name: 'Brush 1 × 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Brush 5 × 5' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Brush 1 × 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Brush 3 × 3' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Brush 5 × 5' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
