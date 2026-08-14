import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { expect, test } from '@playwright/test';
import {
  GAME_SEED,
  WORLD_CONFIG,
  generateCoastalTerrain,
  planTerraformStroke,
  rasterizeTerraformCellLine,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformOperation,
} from './helpers/domain-fixtures.js';
import {
  GAME_URL,
  clickTerrainCell,
  dispatchCanvasTouch,
  readEvidence,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

const BASE_TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: GAME_SEED, config: WORLD_CONFIG });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

function centeredInteriorCells(margin: number): readonly Readonly<{ x: number; z: number }>[] {
  const centerX = (WORLD_CONFIG.mapWidth - 1) / 2;
  const centerZ = (WORLD_CONFIG.mapHeight - 1) / 2;
  const cells: Array<Readonly<{ x: number; z: number }>> = [];
  for (let z = margin; z < WORLD_CONFIG.mapHeight - margin; z += 1) {
    for (let x = margin; x < WORLD_CONFIG.mapWidth - margin; x += 1) {
      cells.push({ x, z });
    }
  }
  return cells.sort((first, second) => {
    const firstDistance = (first.x - centerX) ** 2 + (first.z - centerZ) ** 2;
    const secondDistance = (second.x - centerX) ** 2 + (second.z - centerZ) ** 2;
    return firstDistance - secondDistance || first.z - second.z || first.x - second.x;
  });
}

function findValidCenter(
  terrain: TerrainSnapshot,
  operation: Exclude<TerraformOperation, 'flatten'>,
  brushSize: TerraformBrushSize,
): Readonly<{ x: number; z: number }> {
  for (const cell of centeredInteriorCells(6)) {
    const plan = planTerraformStroke(
      terrain,
      { operation, brushSize, cells: [cell] },
      WORLD_CONFIG,
    );
    if (plan.valid) return cell;
  }
  throw new Error(`terraform-test:no-valid-center:${operation}:${brushSize}`);
}

function findValidRaiseLine(): Readonly<{
  start: Readonly<{ x: number; z: number }>;
  end: Readonly<{ x: number; z: number }>;
}> {
  for (const center of centeredInteriorCells(12)) {
    const start = { x: center.x - 2, z: center.z };
    const end = { x: center.x + 2, z: center.z };
    const plan = planTerraformStroke(
      BASE_TERRAIN,
      {
        operation: 'raise',
        brushSize: 1,
        cells: rasterizeTerraformCellLine(start, end),
      },
      WORLD_CONFIG,
    );
    if (plan.valid) return { start, end };
  }
  throw new Error('terraform-test:no-valid-raise-line');
}

function latticeLevel(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function cellCornerLevels(
  terrain: TerrainSnapshot,
  cell: Readonly<{ x: number; z: number }>,
): readonly number[] {
  return [
    latticeLevel(terrain, cell.x, cell.z),
    latticeLevel(terrain, cell.x + 1, cell.z),
    latticeLevel(terrain, cell.x, cell.z + 1),
    latticeLevel(terrain, cell.x + 1, cell.z + 1),
  ];
}

function findFlatCell(): Readonly<{ x: number; z: number }> {
  for (const cell of centeredInteriorCells(4)) {
    const levels = cellCornerLevels(BASE_TERRAIN, cell);
    if (levels.every((level) => level === levels[0])) return cell;
  }
  throw new Error('terraform-test:no-flat-cell');
}

function findRobustFlattenCell(): Readonly<{ x: number; z: number }> {
  for (const cell of centeredInteriorCells(6)) {
    const levels = cellCornerLevels(BASE_TERRAIN, cell);
    const minimum = Math.min(...levels);
    const maximum = Math.max(...levels);
    if (minimum === maximum) continue;
    const targets = Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
    const allTargetsValid = targets.every(
      (flattenTargetLevel) =>
        planTerraformStroke(
          BASE_TERRAIN,
          {
            operation: 'flatten',
            brushSize: 1,
            cells: [cell],
            flattenTargetLevel,
          },
          WORLD_CONFIG,
        ).valid,
    );
    if (allTargetsValid) return cell;
  }
  throw new Error('terraform-test:no-robust-flatten-cell');
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

test('accumulates Raise Preview and commits once on release', async ({ page }) => {
  await openGame(page);
  const line = findValidRaiseLine();
  const [start, end] = await locatePair(page, line.start, line.end);
  await openBuildCategory(page, 'terrain');
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
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform applied');
  const after = await readEvidence(page);
  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.committedTerrainRevision).toBe(
    before.terraform.committedTerrainRevision + 1,
  );
  expect(after.terraform.waterSourceTerrainRevision).toBe(after.terraform.committedTerrainRevision);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount + 1);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 1);
  expect(after.terraform.undoAvailable).toBe(true);
});

test('Undo restores the prior Terrain snapshot and updates Water once', async ({ page }) => {
  await openGame(page);
  const point = await clickTerrainCell(page, findValidCenter(BASE_TERRAIN, 'raise', 1));
  await openBuildCategory(page, 'terrain');
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform applied');
  const committed = await readEvidence(page);
  await page.getByTestId('tool-context-undo').click();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform undone');
  const undone = await readEvidence(page);

  expect(committed.terraform.committedTerrainRevision).toBe(
    before.terraform.committedTerrainRevision + 1,
  );
  expect(undone.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
  expect(undone.terraform.waterSourceTerrainRevision).toBe(
    undone.terraform.committedTerrainRevision,
  );
  expect(undone.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 2);
  expect(undone.terraform.undoAvailable).toBe(false);
});

for (const [size, count] of [
  [3, 9],
  [5, 25],
] as const) {
  test(`previews brush ${size}x${size} with ${count} cells`, async ({ page }) => {
    await openGame(page);
    const point = await clickTerrainCell(page, findValidCenter(BASE_TERRAIN, 'raise', size));
    await openBuildCategory(page, 'terrain');
    await page.getByRole('button', { name: 'Raise' }).click();
    await page.getByRole('button', { name: `Brush ${size} × ${size}` }).click();

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    const preview = await readEvidence(page);
    expect(preview.terraform.brushSize).toBe(size);
    expect(preview.terraform.previewCellCount).toBe(count);
    expect(preview.terraform.previewValid).toBe(true);
    await page.mouse.up();
  });
}

test('pointer cancellation clears Preview without mutation', async ({ page }) => {
  await openGame(page);
  const point = await clickTerrainCell(page, findValidCenter(BASE_TERRAIN, 'raise', 1));
  await openBuildCategory(page, 'terrain');
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, point.x, point.y);
  expect((await readEvidence(page)).terraform.previewRootCount).toBe(1);
  await dispatchCanvasTouch(page, 'pointercancel', 1, point.x, point.y);
  const after = await readEvidence(page);

  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount);
});

test('second touch cancels Terraform and transfers to camera gestures', async ({ page }) => {
  await openGame(page);
  const point = await clickTerrainCell(page, findValidCenter(BASE_TERRAIN, 'raise', 1));
  await openBuildCategory(page, 'terrain');
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
  expect(transferred.terraform.commitCount).toBe(before.terraform.commitCount);
  expect(transferred.camera.orthographicSize).toBeLessThan(before.camera.orthographicSize);

  await dispatchCanvasTouch(page, 'pointerup', 1, point.x - 48, point.y);
  await dispatchCanvasTouch(page, 'pointerup', 2, point.x + 168, point.y);
  expect((await readEvidence(page)).activePointerCount).toBe(0);
});

test('no-op Flatten previews invalid and does not commit', async ({ page }) => {
  await openGame(page);
  const point = await clickTerrainCell(page, findFlatCell());
  await openBuildCategory(page, 'terrain');
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

test('Flatten locks first valid target for the whole stroke', async ({ page }) => {
  await openGame(page);
  const cell = findRobustFlattenCell();
  const point = await clickTerrainCell(page, cell);
  await openBuildCategory(page, 'terrain');
  await page.getByRole('button', { name: 'Flatten' }).click();
  const before = await readEvidence(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const preview = await readEvidence(page);
  expect(preview.terraform.previewValid).toBe(true);
  expect(preview.terraform.previewRootCount).toBe(1);
  await page.mouse.move(point.x + 12, point.y + 12, { steps: 2 });
  await page.mouse.up();
  const after = await readEvidence(page);

  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount + 1);
});
