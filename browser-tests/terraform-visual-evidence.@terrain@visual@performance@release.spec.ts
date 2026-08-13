import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  WORLD_CONFIG,
  generateCoastalTerrain,
  planTerraformStroke,
  rasterizeTerraformCellLine,
  type TerrainSnapshot,
  type TerraformBrushSize,
} from './helpers/domain-fixtures.js';
import {
  GAME_URL,
  clickTerrainCell,
  readEvidence,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

const OUTPUT_DIRECTORY = 'test-results/terraform-foundation-v0-1';
const SCREENSHOTS = [
  'terraform-game-desktop-navigate.png',
  'terraform-raise-preview-1x1.png',
  'terraform-raise-preview-5x5.png',
  'terraform-invalid-preview.png',
  'terraform-after-commit-water.png',
  'terraform-after-undo.png',
  'terraform-game-mobile-tools.png',
  'terraform-mobile-drag-preview.png',
] as const;

const BASE_TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();

function centeredCells(margin: number): readonly Readonly<{ x: number; z: number }>[] {
  const centerX = (WORLD_CONFIG.mapWidth - 1) / 2;
  const centerZ = (WORLD_CONFIG.mapHeight - 1) / 2;
  const cells: Array<Readonly<{ x: number; z: number }>> = [];
  for (let z = margin; z < WORLD_CONFIG.mapHeight - margin; z += 1) {
    for (let x = margin; x < WORLD_CONFIG.mapWidth - margin; x += 1) cells.push({ x, z });
  }
  return cells.sort((first, second) => {
    const firstDistance = (first.x - centerX) ** 2 + (first.z - centerZ) ** 2;
    const secondDistance = (second.x - centerX) ** 2 + (second.z - centerZ) ** 2;
    return firstDistance - secondDistance || first.z - second.z || first.x - second.x;
  });
}

function validRaiseCell(
  terrain: TerrainSnapshot,
  brushSize: TerraformBrushSize,
): Readonly<{ x: number; z: number }> {
  for (const cell of centeredCells(8)) {
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize, cells: [cell] },
      WORLD_CONFIG,
    );
    if (plan.valid) return cell;
  }
  throw new Error(`terraform-evidence:no-valid-raise:${brushSize}`);
}

function levelAt(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function flatCell(): Readonly<{ x: number; z: number }> {
  for (const cell of centeredCells(6)) {
    const levels = [
      levelAt(BASE_TERRAIN, cell.x, cell.z),
      levelAt(BASE_TERRAIN, cell.x + 1, cell.z),
      levelAt(BASE_TERRAIN, cell.x, cell.z + 1),
      levelAt(BASE_TERRAIN, cell.x + 1, cell.z + 1),
    ];
    if (levels.every((level) => level === levels[0])) return cell;
  }
  throw new Error('terraform-evidence:no-flat-cell');
}

async function openGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
}

interface VisibleTerrainSample {
  readonly point: TerrainCellScreenPoint;
  readonly cell: Readonly<{ x: number; z: number }>;
}

async function findVisibleRaiseLine(
  page: import('@playwright/test').Page,
): Promise<Readonly<{ start: TerrainCellScreenPoint; end: TerrainCellScreenPoint }>> {
  const bounds = await page.locator('#game-canvas').boundingBox();
  if (bounds === null) throw new Error('terraform-evidence:missing-canvas');

  const sampleRatios = [
    [0.5, 0.58],
    [0.42, 0.62],
    [0.58, 0.62],
    [0.32, 0.68],
    [0.5, 0.68],
    [0.68, 0.68],
    [0.25, 0.74],
    [0.42, 0.74],
    [0.58, 0.74],
    [0.75, 0.74],
  ] as const;
  const samples: VisibleTerrainSample[] = [];
  const seenCells = new Set<string>();

  for (const [xRatio, yRatio] of sampleRatios) {
    const point = {
      x: bounds.x + bounds.width * xRatio,
      y: bounds.y + bounds.height * yRatio,
    };
    await page.mouse.click(point.x, point.y);
    const cell = (await readEvidence(page)).selectedCell;
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    }
    if (cell === null) continue;

    const key = `${cell.x}:${cell.z}`;
    if (seenCells.has(key)) continue;
    seenCells.add(key);
    samples.push({ point, cell });
  }

  for (let firstIndex = 0; firstIndex < samples.length; firstIndex += 1) {
    const first = samples[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < samples.length; secondIndex += 1) {
      const second = samples[secondIndex]!;
      const cells = rasterizeTerraformCellLine(first.cell, second.cell);
      if (cells.length < 5) continue;

      const plan = planTerraformStroke(
        BASE_TERRAIN,
        { operation: 'raise', brushSize: 1, cells },
        WORLD_CONFIG,
      );
      if (plan.valid) return { start: first.point, end: second.point };
    }
  }

  throw new Error('terraform-evidence:no-visible-valid-raise-line');
}

test('captures Terraform Foundation visual and timing evidence', async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await openGame(page);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[0]}`,
    fullPage: true,
  });

  const oneCellPoint = await clickTerrainCell(page, validRaiseCell(BASE_TERRAIN, 1));
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.move(oneCellPoint.x, oneCellPoint.y);
  await page.mouse.down();
  let evidence = await readEvidence(page);
  expect(evidence.terraform.previewValid).toBe(true);
  expect(evidence.terraform.previewCellCount).toBe(1);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[1]}`,
    fullPage: true,
  });
  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform applied');
  await page.getByTestId('tool-context-undo').click();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform undone');

  await page.getByTestId('nav-navigate').click();
  const fiveCellPoint = await clickTerrainCell(page, validRaiseCell(BASE_TERRAIN, 5));
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.getByRole('button', { name: 'Brush 5 × 5' }).click();
  await page.mouse.move(fiveCellPoint.x, fiveCellPoint.y);
  await page.mouse.down();
  evidence = await readEvidence(page);
  expect(evidence.terraform.previewCellCount).toBe(25);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[2]}`,
    fullPage: true,
  });
  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform applied');
  await page.getByTestId('tool-context-undo').click();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform undone');

  await page.getByTestId('nav-navigate').click();
  const invalidPoint = await clickTerrainCell(page, flatCell());
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Flatten' }).click();
  await page.getByRole('button', { name: 'Brush 1 × 1' }).click();
  await page.mouse.move(invalidPoint.x, invalidPoint.y);
  await page.mouse.down();
  evidence = await readEvidence(page);
  expect(evidence.terraform.previewValid).toBe(false);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[3]}`,
    fullPage: true,
  });
  await page.mouse.up();

  await page.getByTestId('nav-navigate').click();
  const commitPoint = await clickTerrainCell(page, validRaiseCell(BASE_TERRAIN, 1));
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();
  const commitStart = await page.evaluate(() => performance.now());
  await page.mouse.click(commitPoint.x, commitPoint.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform applied');
  const commitEnd = await page.evaluate(() => performance.now());
  const committed = await readEvidence(page);
  expect(committed.terraform.waterSourceTerrainRevision).toBe(
    committed.terraform.committedTerrainRevision,
  );
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[4]}`,
    fullPage: true,
  });

  const undoStart = await page.evaluate(() => performance.now());
  await page.getByTestId('tool-context-undo').click();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform undone');
  const undoEnd = await page.evaluate(() => performance.now());
  const undone = await readEvidence(page);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[5]}`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[6]}`,
    fullPage: true,
  });

  const line = await findVisibleRaiseLine(page);
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.move(line.start.x, line.start.y);
  await page.mouse.down();
  await page.mouse.move(line.end.x, line.end.y, { steps: 4 });
  const mobilePreview = await readEvidence(page);
  expect(mobilePreview.terraform.previewValid).toBe(true);
  expect(mobilePreview.terraform.previewCellCount).toBeGreaterThanOrEqual(5);
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/${SCREENSHOTS[7]}`,
    fullPage: true,
  });
  await page.mouse.up();

  const performanceEvidence = {
    commitDurationMs: commitEnd - commitStart,
    undoDurationMs: undoEnd - undoStart,
    committedTerrainRevision: committed.terraform.committedTerrainRevision,
    committedWaterRevision: committed.terraform.waterSourceTerrainRevision,
    undoneTerrainRevision: undone.terraform.committedTerrainRevision,
    undoneWaterRevision: undone.terraform.waterSourceTerrainRevision,
    waterRebuildCountAfterCommit: committed.terraform.waterRebuildCount,
    waterRebuildCountAfterUndo: undone.terraform.waterRebuildCount,
    waterDerivationDurationMs: committed.water.derivationDurationMs,
    waterPresentationDurationMs: committed.water.presentationDurationMs,
    rootsAfterCommit: committed.sceneRootCounts,
    rootsAfterUndo: undone.sceneRootCounts,
    screenshots: SCREENSHOTS,
  };
  expect(performanceEvidence.commitDurationMs).toBeGreaterThanOrEqual(0);
  expect(performanceEvidence.undoDurationMs).toBeGreaterThanOrEqual(0);
  expect(performanceEvidence.rootsAfterCommit.preview).toBe(0);
  expect(performanceEvidence.rootsAfterUndo.preview).toBe(0);
  await writeFile(
    `${OUTPUT_DIRECTORY}/terraform-performance-evidence.json`,
    `${JSON.stringify(performanceEvidence, null, 2)}\n`,
    'utf8',
  );
});
