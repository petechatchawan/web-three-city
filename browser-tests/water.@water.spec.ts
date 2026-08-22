import { waitForCityUi } from './helpers/city-ui.js';
import { expect, test } from '@playwright/test';
import {
  clickGameMenuAction,
  createDeterministicWaterGeometryEvidence,
  dispatchCanvasTouch,
  GAME_URL,
  locateTerrainCell,
  readEvidence,
  readTerrainLabWaterEvidence,
  TERRAIN_LAB_URL,
} from './helpers/interaction.js';

const READY_TIMEOUT = 15_000;
const SAVE_KEY = 'web-three-city:world-save:v8';

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

async function openWaterFixture(
  page: import('@playwright/test').Page,
  fixture: string,
): Promise<Awaited<ReturnType<typeof readTerrainLabWaterEvidence>>> {
  await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
  await expect(page.getByTestId('water-status')).toHaveText('Ready');
  return readTerrainLabWaterEvidence(page);
}

test('Water remains framed on desktop and mobile with exactly one root', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGame(page);
  let evidence = await readEvidence(page);
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
  expect(evidence.water.waterRootCount).toBe(1);
  expect(evidence.sceneRootCounts.water).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await waitForCityUi(page);
  evidence = await readEvidence(page);
  expect(evidence.allWorldCornersInsideUsableViewport).toBe(true);
  expect(evidence.water.waterRootCount).toBe(1);
});

test('underwater selection and Grid remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGame(page);
  await clickGameMenuAction(page, 'Grid');
  const point = await locateTerrainCell(page, { x: 64, z: 116 });
  await page.mouse.click(point.x, point.y);

  const evidence = await readEvidence(page);
  expect(evidence.gridVisible).toBe(true);
  expect(evidence.selectedCell).toEqual({ x: 64, z: 116 });
  expect(evidence.water.waterRootCount).toBe(1);
  const inspect = page.getByTestId('inspect-surface');
  await expect(inspect).toBeVisible();
  await expect(inspect).toContainText('64, 116');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('pan, zoom, yaw, pitch, and reset remain stable with Water', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGame(page);
  const initial = await readEvidence(page);

  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  let evidence = await readEvidence(page);
  expect(evidence.camera.targetX === 0 && evidence.camera.targetZ === 0).toBe(false);

  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -480);
  evidence = await readEvidence(page);
  expect(evidence.camera.orthographicSize).toBeLessThan(initial.camera.orthographicSize);

  await clickGameMenuAction(page, 'Rotate right');
  evidence = await readEvidence(page);
  expect(evidence.camera.yawDegrees).not.toBe(initial.camera.yawDegrees);

  await dispatchCanvasTouch(page, 'pointerdown', 31, 850, 520);
  await dispatchCanvasTouch(page, 'pointerdown', 32, 950, 520);
  for (const y of [510, 500, 490, 480]) {
    await dispatchCanvasTouch(page, 'pointermove', 31, 850, y);
    await dispatchCanvasTouch(page, 'pointermove', 32, 950, y);
  }
  await dispatchCanvasTouch(page, 'pointerup', 31, 850, 480);
  await dispatchCanvasTouch(page, 'pointerup', 32, 950, 480);
  evidence = await readEvidence(page);
  expect(evidence.camera.pitchDegrees).toBeGreaterThan(initial.camera.pitchDegrees);

  await clickGameMenuAction(page, 'Reset camera');
  evidence = await readEvidence(page);
  expect(evidence.camera).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
  expect(evidence.water.waterRootCount).toBe(1);
});

test('save and load reproduce deterministic Water state', async ({ page }) => {
  await openGame(page);
  const before = (await readEvidence(page)).water;
  await clickGameMenuAction(page, 'Save world');
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).not.toBeNull();
  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('tool-context-status')).toHaveText('Loaded');
  const after = (await readEvidence(page)).water;

  expect(after).toMatchObject({
    sourceTerrainRevision: before.sourceTerrainRevision,
    seaTriangleCount: before.seaTriangleCount,
    enclosedWetTriangleCount: before.enclosedWetTriangleCount,
    shorelineSegmentCount: before.shorelineSegmentCount,
    surfaceTriangleCount: before.surfaceTriangleCount,
    shorelineTriangleCount: before.shorelineTriangleCount,
    wallSegmentCount: before.wallSegmentCount,
    estimatedGeometryBytes: before.estimatedGeometryBytes,
    waterRootCount: 1,
  });
});

test('context restoration atomically replaces the Water root', async ({ page }) => {
  await openGame(page);
  expect((await readEvidence(page)).sceneRootCounts.water).toBe(1);
  const canvas = page.locator('#game-canvas');
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    element.dispatchEvent(new Event('webglcontextrestored'));
  });
  await waitForCityUi(page);
  const evidence = await readEvidence(page);
  expect(evidence.water.waterRootCount).toBe(1);
  expect(evidence.sceneRootCounts.water).toBe(1);
});

test('south-edge connectivity keeps enclosed basin dry and opens a channel', async ({ page }) => {
  const enclosed = await openWaterFixture(page, 'water-enclosed-basin');
  expect(enclosed).toMatchObject({
    seaTriangleCount: 0,
    enclosedWetTriangleCount: 200,
    waterRootCount: 1,
  });

  const open = await openWaterFixture(page, 'water-open-channel');
  expect(open).toMatchObject({
    seaTriangleCount: 770,
    enclosedWetTriangleCount: 0,
    waterRootCount: 1,
  });
});

test('chunk seam and south wall fixtures preserve deterministic topology', async ({ page }) => {
  const seam = await openWaterFixture(page, 'water-chunk-seam');
  expect(seam).toMatchObject({
    seaTriangleCount: 8482,
    enclosedWetTriangleCount: 0,
    waterRootCount: 1,
  });

  const wall = await openWaterFixture(page, 'water-south-wall');
  expect(wall).toMatchObject({
    seaTriangleCount: 1476,
    enclosedWetTriangleCount: 0,
    waterRootCount: 1,
  });
});

test('Water geometry bytes and hash are deterministic', () => {
  const evidence = createDeterministicWaterGeometryEvidence();
  expect(evidence).toEqual({
    seaTriangleCount: 6440,
    enclosedWetTriangleCount: 0,
    shorelineSegmentCount: 188,
    surfaceTriangleCount: 6440,
    shorelineTriangleCount: 379,
    wallSegmentCount: 1,
    estimatedGeometryBytes: 754710,
    geometrySha256: '95ae8947b844f08081314736c46cfbbb48348d1134c589411919102e3c5a0e60',
  });
});
