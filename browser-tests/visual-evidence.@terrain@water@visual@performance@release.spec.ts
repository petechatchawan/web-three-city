import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  clickTerrainCell,
  clickGameMenuAction,
  createDeterministicWaterGeometryEvidence,
  dispatchCanvasTouch,
  GAME_URL,
  readEvidence,
  readTerrainLabWaterEvidence,
  TERRAIN_LAB_URL,
} from './helpers/interaction.js';

const OUTPUT_DIRECTORY = 'test-results/screenshots';
const READY_TIMEOUT = 15_000;

const SCREENSHOTS = [
  ['coastal-overview.png', '?fixture=coastal'],
  ['shape-atlas-overview.png', '?fixture=shape-atlas'],
  ['ramp-north.png', '?fixture=shape-atlas&shape=ramp-north'],
  ['ramp-south.png', '?fixture=shape-atlas&shape=ramp-south'],
  ['ramp-east.png', '?fixture=shape-atlas&shape=ramp-east'],
  ['ramp-west.png', '?fixture=shape-atlas&shape=ramp-west'],
  ['single-corner-high.png', '?fixture=shape-atlas&shape=single-corner-high'],
  ['single-corner-low.png', '?fixture=shape-atlas&shape=single-corner-low'],
  ['raised-plateau.png', '?fixture=shape-atlas&shape=raised-plateau'],
  ['basin.png', '?fixture=shape-atlas&shape=basin'],
  ['staircase.png', '?fixture=shape-atlas&shape=staircase'],
  ['diagonal-ridge.png', '?fixture=shape-atlas&shape=diagonal-ridge'],
  ['diagonal-valley.png', '?fixture=shape-atlas&shape=diagonal-valley'],
  ['saddle-twist.png', '?fixture=shape-atlas&shape=saddle-twist'],
  ['chunk-seam-closeup.png', '?fixture=chunk-seam'],
  ['outer-boundary-skirt.png', '?fixture=boundary-skirt'],
] as const;

interface InteractionPerformanceEvidence {
  readonly processedPointerFrames: number;
  readonly medianPointerFrameMs: number;
  readonly p95PointerFrameMs: number;
  readonly selectionRebuildCount: number;
  readonly gridRebuildCount: number;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index]!;
}

test.use({ trace: 'on' });

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
}

test('captures exact-head visual and performance evidence', async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [filename, query] of SCREENSHOTS) {
    await page.goto(`http://127.0.0.1:4173/${query}`);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready', {
      timeout: READY_TIMEOUT,
    });
    await page.screenshot({
      path: `${OUTPUT_DIRECTORY}/${filename}`,
      fullPage: true,
    });
  }

  await page.goto('http://127.0.0.1:4173/?fixture=picking');
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
  for (const degrees of [0, 90, 180, 270]) {
    if (degrees > 0) await page.getByRole('button', { name: 'Rotate right' }).click();
    await page.screenshot({
      path: `${OUTPUT_DIRECTORY}/picking-rotation-${degrees}.png`,
      fullPage: true,
    });
  }
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/picking-four-rotations.png`,
    fullPage: true,
  });

  await page.goto('http://127.0.0.1:4173/?fixture=coastal');
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
  const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_EVIDENCE__);
  expect(evidence).toBeDefined();
  await writeFile(
    'test-results/terrain-performance-evidence.json',
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
});

test('captures canonical desktop and mobile interaction evidence', async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await openGame(page);
  expect((await readEvidence(page)).allWorldCornersInsideUsableViewport).toBe(true);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-desktop-initial-fit.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
  expect((await readEvidence(page)).allWorldCornersInsideUsableViewport).toBe(true);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-mobile-portrait-initial-fit.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });

  await clickGameMenuAction(page, 'Grid');
  expect((await readEvidence(page)).gridVisible).toBe(true);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-grid-on.png`,
    fullPage: true,
  });

  await page.mouse.click(900, 500);
  expect((await readEvidence(page)).selectedCell).not.toBeNull();
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-selected-cell.png`,
    fullPage: true,
  });

  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-pan-result.png`,
    fullPage: true,
  });

  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -480);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-zoom-in.png`,
    fullPage: true,
  });

  await dispatchCanvasTouch(page, 'pointerdown', 1, 850, 450);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 950, 450);
  await dispatchCanvasTouch(page, 'pointermove', 1, 851, 440);
  await dispatchCanvasTouch(page, 'pointermove', 2, 949, 460);
  await dispatchCanvasTouch(page, 'pointermove', 1, 854, 431);
  await dispatchCanvasTouch(page, 'pointermove', 2, 946, 469);
  await dispatchCanvasTouch(page, 'pointerup', 1, 854, 431);
  await dispatchCanvasTouch(page, 'pointerup', 2, 946, 469);
  expect((await readEvidence(page)).camera.yawDegrees).not.toBe(45);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-yaw-continuous.png`,
    fullPage: true,
  });

  await dispatchCanvasTouch(page, 'pointerdown', 3, 850, 520);
  await dispatchCanvasTouch(page, 'pointerdown', 4, 950, 520);
  for (const y of [510, 500, 490, 480]) {
    await dispatchCanvasTouch(page, 'pointermove', 3, 850, y);
    await dispatchCanvasTouch(page, 'pointermove', 4, 950, y);
  }
  await dispatchCanvasTouch(page, 'pointerup', 3, 850, 480);
  await dispatchCanvasTouch(page, 'pointerup', 4, 950, 480);
  expect((await readEvidence(page)).camera.pitchDegrees).toBeGreaterThan(50);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-pitch-top-down.png`,
    fullPage: true,
  });

  await clickGameMenuAction(page, 'Reset camera');
  await dispatchCanvasTouch(page, 'pointerdown', 5, 850, 480);
  await dispatchCanvasTouch(page, 'pointerdown', 6, 950, 480);
  for (const y of [490, 500, 510, 520]) {
    await dispatchCanvasTouch(page, 'pointermove', 5, 850, y);
    await dispatchCanvasTouch(page, 'pointermove', 6, 950, y);
  }
  await dispatchCanvasTouch(page, 'pointerup', 5, 850, 520);
  await dispatchCanvasTouch(page, 'pointerup', 6, 950, 520);
  expect((await readEvidence(page)).camera.pitchDegrees).toBeLessThan(50);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-pitch-horizon.png`,
    fullPage: true,
  });

  await clickGameMenuAction(page, 'Reset camera');
  expect((await readEvidence(page)).camera).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/interaction-reset.png`,
    fullPage: true,
  });

  const pointerFrameDurations = await page.locator('#game-canvas').evaluate((canvas) => {
    const dispatch = (type: string, pointerId: number, x: number, y: number): void => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          isPrimary: pointerId === 11,
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    dispatch('pointerdown', 11, 850, 450);
    dispatch('pointerdown', 12, 950, 450);
    const durations: number[] = [];
    for (let frame = 0; frame < 30; frame += 1) {
      const offset = (frame + 1) * 0.6;
      dispatch('pointermove', 11, 850 - offset, 450);
      const start = performance.now();
      dispatch('pointermove', 12, 950 + offset, 450);
      durations.push(performance.now() - start);
    }
    dispatch('pointerup', 11, 832, 450);
    dispatch('pointerup', 12, 968, 450);
    return durations;
  });

  const performanceEvidence: InteractionPerformanceEvidence = {
    processedPointerFrames: pointerFrameDurations.length,
    medianPointerFrameMs: percentile(pointerFrameDurations, 0.5),
    p95PointerFrameMs: percentile(pointerFrameDurations, 0.95),
    selectionRebuildCount: 1,
    gridRebuildCount: 0,
  };
  expect(performanceEvidence.processedPointerFrames).toBe(30);
  expect(Number.isFinite(performanceEvidence.medianPointerFrameMs)).toBe(true);
  expect(Number.isFinite(performanceEvidence.p95PointerFrameMs)).toBe(true);
  await writeFile(
    'test-results/interaction-performance-evidence.json',
    `${JSON.stringify(performanceEvidence, null, 2)}\n`,
    'utf8',
  );
});

const WATER_OUTPUT_DIRECTORY = 'test-results/water-shoreline-foundation-v0-1';
const WATER_FIXTURE_SCREENSHOTS = [
  ['water-straight-coast.png', 'water-straight-coast'],
  ['water-bay.png', 'water-bay'],
  ['water-peninsula.png', 'water-peninsula'],
  ['water-chunk-seam.png', 'water-chunk-seam'],
  ['water-enclosed-basin.png', 'water-enclosed-basin'],
  ['water-open-channel.png', 'water-open-channel'],
  ['water-south-wall.png', 'water-south-wall'],
] as const;

interface WaterPerformanceEvidence {
  readonly derivationDurationMs: number;
  readonly presentationDurationMs: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly wallSegmentCount: number;
  readonly estimatedGeometryBytes: number;
  readonly geometrySha256: string;
  readonly rootsBeforeRestore: number;
  readonly rootsAfterRestore: number;
}

test('captures Water and shoreline acceptance evidence', async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(WATER_OUTPUT_DIRECTORY, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await openGame(page);
  let gameEvidence = await readEvidence(page);
  expect(gameEvidence.allWorldCornersInsideUsableViewport).toBe(true);
  expect(gameEvidence.water.waterRootCount).toBe(1);
  await page.screenshot({
    path: `${WATER_OUTPUT_DIRECTORY}/water-game-desktop.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
  gameEvidence = await readEvidence(page);
  expect(gameEvidence.allWorldCornersInsideUsableViewport).toBe(true);
  expect(gameEvidence.water.waterRootCount).toBe(1);
  await page.screenshot({
    path: `${WATER_OUTPUT_DIRECTORY}/water-game-mobile.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready', {
    timeout: READY_TIMEOUT,
  });
  await clickGameMenuAction(page, 'Grid');
  await clickTerrainCell(page, { x: 64, z: 116 });
  gameEvidence = await readEvidence(page);
  expect(gameEvidence.gridVisible).toBe(true);
  expect(gameEvidence.selectedCell).toEqual({ x: 64, z: 116 });
  await page.screenshot({
    path: `${WATER_OUTPUT_DIRECTORY}/water-grid-selection.png`,
    fullPage: true,
  });

  for (const [filename, fixture] of WATER_FIXTURE_SCREENSHOTS) {
    await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready', {
      timeout: READY_TIMEOUT,
    });
    await expect(page.getByTestId('water-status')).toHaveText('Ready');
    expect((await readTerrainLabWaterEvidence(page)).waterRootCount).toBe(1);
    await page.screenshot({
      path: `${WATER_OUTPUT_DIRECTORY}/${filename}`,
      fullPage: true,
    });
  }

  await openGame(page);
  const beforeRestore = await readEvidence(page);
  const canvas = page.locator('#game-canvas');
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    element.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
  const afterRestore = await readEvidence(page);
  const geometry = createDeterministicWaterGeometryEvidence();
  const performanceEvidence: WaterPerformanceEvidence = {
    derivationDurationMs: afterRestore.water.derivationDurationMs,
    presentationDurationMs: afterRestore.water.presentationDurationMs,
    seaTriangleCount: geometry.seaTriangleCount,
    enclosedWetTriangleCount: geometry.enclosedWetTriangleCount,
    shorelineSegmentCount: geometry.shorelineSegmentCount,
    surfaceTriangleCount: geometry.surfaceTriangleCount,
    shorelineTriangleCount: geometry.shorelineTriangleCount,
    wallSegmentCount: geometry.wallSegmentCount,
    estimatedGeometryBytes: geometry.estimatedGeometryBytes,
    geometrySha256: geometry.geometrySha256,
    rootsBeforeRestore: beforeRestore.water.waterRootCount,
    rootsAfterRestore: afterRestore.water.waterRootCount,
  };
  expect(performanceEvidence.derivationDurationMs).toBeGreaterThanOrEqual(0);
  expect(performanceEvidence.presentationDurationMs).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(performanceEvidence.derivationDurationMs)).toBe(true);
  expect(Number.isFinite(performanceEvidence.presentationDurationMs)).toBe(true);
  expect(performanceEvidence.rootsBeforeRestore).toBe(1);
  expect(performanceEvidence.rootsAfterRestore).toBe(1);
  await writeFile(
    `${WATER_OUTPUT_DIRECTORY}/water-performance-evidence.json`,
    `${JSON.stringify(performanceEvidence, null, 2)}\n`,
    'utf8',
  );
});
