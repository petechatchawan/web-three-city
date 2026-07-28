import { expect, test } from '@playwright/test';
import {
  planTerraformStroke,
  rasterizeTerraformCellLine,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformOperation,
} from '../packages/terrain-core/src/index.js';
import { generateCoastalTerrain } from '../packages/terrain-generator/src/index.js';
import { WORLD_CONFIG } from '../packages/world-core/src/index.js';
import {
  GAME_URL,
  clickTerrainCell,
  dispatchCanvasTouch,
  readEvidence,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

const GAME_SEED = 1_464_156_977;
const BASE_TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: GAME_SEED, config: WORLD_CONFIG });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

function findValidCenter(
  terrain: TerrainSnapshot,
  operation: Exclude<TerraformOperation, 'flatten'>,
  brushSize: TerraformBrushSize,
): Readonly<{ x: number; z: number }> {
  for (let z = 6; z < WORLD_CONFIG.mapHeight - 6; z += 1) {
    for (let x = 6; x < WORLD_CONFIG.mapWidth - 6; x += 1) {
      const cell = { x, z };
      const plan = planTerraformStroke(
        terrain,
        { operation, brushSize, cells: [cell] },
        WORLD_CONFIG,
      );
      if (plan.valid) return cell;
    }
  }
  throw new Error(`terraform-test:no-valid-center:${operation}:${brushSize}`);
}

function findValidRaiseLine(): Readonly<{
  start: Readonly<{ x: number; z: number }>;
  end: Readonly<{ x: number; z: number }>;
}> {
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 12; x += 1) {
      const start = { x, z };
      const end = { x: x + 4, z };
      const cells = rasterizeTerraformCellLine(start, end);
      const plan = planTerraformStroke(
        BASE_TERRAIN,
        { operation: 'raise', brushSize: 1, cells },
        WORLD_CONFIG,
      );
      if (plan.valid) return { start, end };
    }
  }
  throw new Error('terraform-test:no-valid-raise-line');
}

function latticeLevel(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function findRobustFlattenCell(): Readonly<{ x: number; z: number }> {
  for (let z = 6; z < WORLD_CONFIG.mapHeight - 6; z += 1) {
    for (let x = 6; x < WORLD_CONFIG.mapWidth - 6; x += 1) {
      const cornerLevels = [
        latticeLevel(BASE_TERRAIN, x, z),
        latticeLevel(BASE_TERRAIN, x + 1, z),
        latticeLevel(BASE_TERRAIN, x, z + 1),
        latticeLevel(BASE_TERRAIN, x + 1, z + 1),
      ];
      const minimum = Math.min(...cornerLevels);
      const maximum = Math.max(...cornerLevels);
      if (minimum === maximum) continue;
      const targets = Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
      if (
        targets.every(
          (target) =>
            planTerraformStroke(
              BASE_TERRAIN,
              {
                operation: 'flatten',
                brushSize: 1,
                cells: [{ x, z }],
                flattenTargetLevel: target,
              },
              WORLD_CONFIG,
            ).valid,
        )
      ) {
        return { x, z };
      }
    }
  }
  throw new Error('terraform-test:no-robust-flatten-cell');
}

function findFlatCell(): Readonly<{ x: number; z: number }> {
  for (let z = 4; z < WORLD_CONFIG.mapHeight - 4; z += 1) {
    for (let x = 4; x < WORLD_CONFIG.mapWidth - 4; x += 1) {
      const levels = [
        latticeLevel(BASE_TERRAIN, x, z),
        latticeLevel(BASE_TERRAIN, x + 1, z),
        latticeLevel(BASE_TERRAIN, x, z + 1),
        latticeLevel(BASE_TERRAIN, x + 1, z + 1),
      ];
      if (levels.every((level) => level === levels[0])) return { x, z };
    }
  }
  throw new Error('terraform-test:no-flat-cell');
}

async function locatePair(
  page: import('@playwright/test').Page,
  first: Readonly<{ x: number; z: number }>,
  second: Readonly<{ x: number; z: number }>,
): Promise<readonly [TerrainCellScreenPoint, TerrainCellScreenPoint]> {
  const firstPoint = await clickTerrainCell(page, first);
  const secondPoint = await clickTerrainCell(page, second);
  return [firstPoint, secondPoint];
}

test('accumulates Raise Preview and commits exactly once on release', async ({ page }) => {
  await openGame(page);
  const line = findValidRaiseLine();
  const [start, end] = await locatePair(page, line.start, line.end);
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });

  const preview = await readEvidence(page);
  expect(preview.terraform.strokeActive).toBe(true);
  expect(preview.terraform.previewValid).toBe(true);
  expect(preview.terraform.previewCellCount).toBeGreaterThanOrEqual(5);
  expect(preview.terraform.previewRootCount).toBe(1);
  expect(preview.terraform.committedTerrainRevision).toBe(
    before.terraform.committedTerrainRevision,
  );
  expect(preview.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount);

  await page.mouse.up();
  await expect(page.getByTestId('game-status')).toHaveText('Terraform applied');
  const after = await readEvidence(page);
  expect(after.terraform.strokeActive).toBe(false);
  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.committedTerrainRevision).toBe(
    before.terraform.committedTerrainRevision + 1,
  );
  expect(after.terraform.waterSourceTerrainRevision).toBe(after.terraform.committedTerrainRevision);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount + 1);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 1);
  expect(after.terraform.undoAvailable).toBe(true);
  await expect(page.getByRole('button', { name: 'Undo Terraform' })).toBeEnabled();
});

test('Undo restores Terrain through a newer revision and updates Water once', async ({ page }) => {
  await openGame(page);
  const cell = findValidCenter(BASE_TERRAIN, 'raise', 1);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('game-status')).toHaveText('Terraform applied');
  const committed = await readEvidence(page);
  await page.getByRole('button', { name: 'Undo Terraform' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Terraform undone');
  const undone = await readEvidence(page);

  expect(committed.terraform.committedTerrainRevision).toBe(
    before.terraform.committedTerrainRevision + 1,
  );
  expect(undone.terraform.committedTerrainRevision).toBe(
    committed.terraform.committedTerrainRevision + 1,
  );
  expect(undone.terraform.waterSourceTerrainRevision).toBe(
    undone.terraform.committedTerrainRevision,
  );
  expect(undone.terraform.undoCount).toBe(before.terraform.undoCount + 1);
  expect(undone.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 2);
  expect(undone.terraform.undoAvailable).toBe(false);
  await expect(page.getByRole('button', { name: 'Undo Terraform' })).toBeDisabled();
});

for (const [size, count] of [
  [3, 9],
  [5, 25],
] as const) {
  test(`previews brush ${size}x${size} with ${count} affected cells`, async ({ page }) => {
    await openGame(page);
    const cell = findValidCenter(BASE_TERRAIN, 'raise', size);
    const point = await clickTerrainCell(page, cell);
    await page.getByRole('button', { name: `Brush ${size} × ${size}` }).click();
    await page.getByRole('button', { name: 'Raise' }).click();

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    const preview = await readEvidence(page);
    expect(preview.terraform.brushSize).toBe(size);
    expect(preview.terraform.previewCellCount).toBe(count);
    expect(preview.terraform.previewValid).toBe(true);
    await page.mouse.up();
  });
}

test('pointer cancellation clears Preview without changing Terrain or Water', async ({ page }) => {
  await openGame(page);
  const cell = findValidCenter(BASE_TERRAIN, 'raise', 1);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, point.x, point.y);
  expect((await readEvidence(page)).terraform.previewRootCount).toBe(1);
  await dispatchCanvasTouch(page, 'pointercancel', 1, point.x, point.y);
  const after = await readEvidence(page);

  expect(after.terraform.strokeActive).toBe(false);
  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount);
});

test('a second touch cancels Terraform and transfers to camera gestures', async ({ page }) => {
  await openGame(page);
  const cell = findValidCenter(BASE_TERRAIN, 'raise', 1);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, point.x, point.y);
  await dispatchCanvasTouch(page, 'pointerdown', 2, point.x + 120, point.y);
  for (const offset of [12, 24, 36, 48]) {
    await dispatchCanvasTouch(page, 'pointermove', 1, point.x - offset, point.y);
    await dispatchCanvasTouch(page, 'pointermove', 2, point.x + 120 + offset, point.y);
  }
  const transferred = await readEvidence(page);
  expect(transferred.terraform.previewRootCount).toBe(0);
  expect(transferred.terraform.strokeActive).toBe(false);
  expect(transferred.terraform.commitCount).toBe(before.terraform.commitCount);
  expect(transferred.camera.orthographicSize).toBeLessThan(before.camera.orthographicSize);

  await dispatchCanvasTouch(page, 'pointerup', 1, point.x - 48, point.y);
  await dispatchCanvasTouch(page, 'pointerup', 2, point.x + 168, point.y);
  expect((await readEvidence(page)).activePointerCount).toBe(0);
});

test('no-op Flatten previews invalid and does not commit', async ({ page }) => {
  await openGame(page);
  const cell = findFlatCell();
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Flatten' }).click();
  const before = await readEvidence(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const preview = await readEvidence(page);
  expect(preview.terraform.previewValid).toBe(false);
  expect(preview.terraform.previewRootCount).toBe(1);
  await page.mouse.up();
  const after = await readEvidence(page);

  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount);
  expect(after.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
});

test('Lower commits through the shared transaction path', async ({ page }) => {
  await openGame(page);
  const cell = findValidCenter(BASE_TERRAIN, 'lower', 1);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Lower' }).click();
  const before = await readEvidence(page);

  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('game-status')).toHaveText('Terraform applied');
  const after = await readEvidence(page);

  expect(after.terraform.commitCount).toBe(before.terraform.commitCount + 1);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 1);
  expect(after.terraform.waterSourceTerrainRevision).toBe(after.terraform.committedTerrainRevision);
});

test('Flatten locks pointer-down target and commits through the shared path', async ({ page }) => {
  await openGame(page);
  const cell = findRobustFlattenCell();
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Flatten' }).click();
  const before = await readEvidence(page);

  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('game-status')).toHaveText('Terraform applied');
  const after = await readEvidence(page);

  expect(after.terraform.commitCount).toBe(before.terraform.commitCount + 1);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 1);
});

test('context loss cancels an active Terraform Preview without committing', async ({ page }) => {
  await openGame(page);
  const cell = findValidCenter(BASE_TERRAIN, 'raise', 1);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, point.x, point.y);
  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  const lost = await readEvidence(page);
  expect(lost.terraform.previewRootCount).toBe(0);
  expect(lost.terraform.commitCount).toBe(before.terraform.commitCount);
  expect(lost.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
});

test('load clears Undo and idle Preview state', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Save terrain' }).click();
  const cell = findValidCenter(BASE_TERRAIN, 'raise', 1);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.click(point.x, point.y);
  expect((await readEvidence(page)).terraform.undoAvailable).toBe(true);

  await page.getByRole('button', { name: 'Load terrain' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  const loaded = await readEvidence(page);
  expect(loaded.terraform.undoAvailable).toBe(false);
  expect(loaded.terraform.previewRootCount).toBe(0);
  expect(loaded.terraform.waterSourceTerrainRevision).toBe(
    loaded.terraform.committedTerrainRevision,
  );
});
