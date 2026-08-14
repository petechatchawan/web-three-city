import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  GAME_SEED,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  deriveWaterSnapshot,
  generateCoastalTerrain,
  planRoadMutation,
  terrainCellSurfaceProfile,
  triangleIndexFor,
  type CellCoord,
  type RoadPlacementEnvironment,
} from './helpers/domain-fixtures.js';
import {
  GAME_URL,
  clickTerrainCell,
  readEvidence,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

test.describe.configure({ timeout: 90_000 });

const BASE_TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: GAME_SEED, config: WORLD_CONFIG });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();
const BASE_WATER = (() => {
  const result = deriveWaterSnapshot(BASE_TERRAIN, WORLD_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();
const BASE_ENVIRONMENT: RoadPlacementEnvironment = Object.freeze({
  terrainRevision: BASE_TERRAIN.revision,
  waterSourceTerrainRevision: BASE_WATER.sourceTerrainRevision,
  surfaceAt(cell: CellCoord) {
    return terrainCellSurfaceProfile(BASE_TERRAIN, cell, WORLD_CONFIG);
  },
  isDry(cell: CellCoord) {
    const first = triangleIndexFor(cell.x, cell.z, 0, WORLD_CONFIG.mapWidth);
    const second = triangleIndexFor(cell.x, cell.z, 1, WORLD_CONFIG.mapWidth);
    return BASE_WATER.seaTriangleMask[first] === 0 && BASE_WATER.seaTriangleMask[second] === 0;
  },
});

interface IsolationLine {
  readonly cells: readonly CellCoord[];
  readonly committed: CellCoord;
  readonly active: readonly CellCoord[];
}

interface BranchPath {
  readonly forward: readonly CellCoord[];
  readonly retained: readonly CellCoord[];
  readonly abandoned: readonly CellCoord[];
}

function interiorCells(): readonly CellCoord[] {
  const cells: CellCoord[] = [];
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 12; x += 1) cells.push({ x, z });
  }
  const centerX = WORLD_CONFIG.mapWidth / 2;
  const centerZ = WORLD_CONFIG.mapHeight / 2;
  return cells.sort(
    (first, second) =>
      (first.x - centerX) ** 2 +
        (first.z - centerZ) ** 2 -
        ((second.x - centerX) ** 2 + (second.z - centerZ) ** 2) ||
      first.z - second.z ||
      first.x - second.x,
  );
}

function validBuild(cells: readonly CellCoord[]): boolean {
  return planRoadMutation(
    createEmptyRoadSnapshot(WORLD_CONFIG),
    { operation: 'build', definitionId: 'basic-road', cells },
    BASE_ENVIRONMENT,
    WORLD_CONFIG,
  ).valid;
}

function findIsolationLine(): IsolationLine {
  for (const start of interiorCells()) {
    const cells = Array.from({ length: 10 }, (_, index) => ({
      x: start.x + index,
      z: start.z,
    }));
    const firstChunk = Math.floor(cells[0]!.x / WORLD_CONFIG.chunkSize);
    const lastChunk = Math.floor(cells.at(-1)!.x / WORLD_CONFIG.chunkSize);
    if (firstChunk !== lastChunk) continue;
    const committed = cells[0]!;
    const active = cells.slice(4, 9);
    if (validBuild([committed, ...active])) {
      return Object.freeze({ cells, committed, active: Object.freeze(active) });
    }
  }
  throw new Error('road-reversible:no-isolation-line');
}

function findBranchPath(): BranchPath {
  for (const start of interiorCells()) {
    const forward = Array.from({ length: 5 }, (_, index) => ({
      x: start.x + index,
      z: start.z,
    }));
    const branch = [
      { x: start.x + 2, z: start.z + 1 },
      { x: start.x + 2, z: start.z + 2 },
    ];
    const retained = [...forward.slice(0, 3), ...branch];
    if (validBuild(forward) && validBuild(retained)) {
      return Object.freeze({
        forward: Object.freeze(forward),
        retained: Object.freeze(retained),
        abandoned: Object.freeze(forward.slice(3)),
      });
    }
  }
  throw new Error('road-reversible:no-branch-path');
}

function findRoadLine(length: number): readonly CellCoord[] {
  for (const start of interiorCells()) {
    const cells = Array.from({ length }, (_, index) => ({
      x: start.x + index,
      z: start.z,
    }));
    if (validBuild(cells)) return Object.freeze(cells);
  }
  throw new Error('road-reversible:no-road-line');
}

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

async function locateCells(
  page: Page,
  cells: readonly CellCoord[],
): Promise<readonly TerrainCellScreenPoint[]> {
  const points: TerrainCellScreenPoint[] = [];
  for (const cell of cells) points.push(await clickTerrainCell(page, cell));
  return Object.freeze(points);
}

async function settleRendering(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function captureCellRegion(page: Page, point: TerrainCellScreenPoint): Promise<Buffer> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('road-reversible:missing-viewport');
  const radius = 14;
  const x = Math.max(0, Math.min(viewport.width - radius * 2, point.x - radius));
  const y = Math.max(0, Math.min(viewport.height - radius * 2, point.y - radius));
  return page.screenshot({ clip: { x, y, width: radius * 2, height: radius * 2 } });
}

async function attachPng(testInfo: TestInfo, name: string, body: Buffer): Promise<void> {
  await testInfo.attach(name, { body, contentType: 'image/png' });
}

async function expectRoadCounts(page: Page, requested: number): Promise<void> {
  const evidence = await readEvidence(page);
  expect(evidence.road.previewValid).toBe(true);
  expect(evidence.road.previewCellCount).toBe(requested);
}

function cellMinimumX(cell: CellCoord): number {
  return (cell.x - WORLD_CONFIG.mapWidth / 2) * WORLD_CONFIG.cellSize;
}

async function requireRoadPreviewBounds(page: Page) {
  const bounds = (await readEvidence(page)).road.previewBounds;
  if (bounds === null) throw new Error('road-reversible:missing-preview-bounds');
  return bounds;
}

test('Build Preview stays isolated and exact reverse removes the abandoned tail', async ({
  page,
}, testInfo) => {
  await openGame(page);
  const line = findIsolationLine();
  const points = await locateCells(page, line.cells);
  const committedPoint = points[0]!;
  const activePoints = points.slice(4, 9);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(committedPoint.x, committedPoint.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  const afterCommitted = await readEvidence(page);
  expect(afterCommitted.road.occupiedCellCount).toBe(1);

  await page.mouse.move(activePoints[0]!.x, activePoints[0]!.y);
  await settleRendering(page);
  const committedBaseline = await captureCellRegion(page, committedPoint);
  const abandonedBaseline = await captureCellRegion(page, activePoints.at(-1)!);
  await attachPng(testInfo, 'build-committed-baseline', committedBaseline);
  await attachPng(testInfo, 'build-abandoned-baseline', abandonedBaseline);

  await page.mouse.down();
  await page.mouse.move(activePoints.at(-1)!.x, activePoints.at(-1)!.y, { steps: 8 });
  await settleRendering(page);
  await expectRoadCounts(page, 5);
  const committedDuringPreview = await captureCellRegion(page, committedPoint);
  const abandonedDuringPreview = await captureCellRegion(page, activePoints.at(-1)!);
  await attachPng(testInfo, 'build-committed-during-preview', committedDuringPreview);
  await attachPng(testInfo, 'build-forward-preview', abandonedDuringPreview);
  const forwardBounds = await requireRoadPreviewBounds(page);
  expect(forwardBounds.minX).toBeGreaterThanOrEqual(cellMinimumX(line.active[0]!) - 0.0001);
  expect(Buffer.compare(abandonedDuringPreview, abandonedBaseline)).not.toBe(0);

  await page.mouse.move(activePoints[2]!.x, activePoints[2]!.y, { steps: 6 });
  await settleRendering(page);
  await expectRoadCounts(page, 3);
  const committedAfterReverse = await captureCellRegion(page, committedPoint);
  const abandonedAfterReverse = await captureCellRegion(page, activePoints.at(-1)!);
  await attachPng(testInfo, 'build-committed-after-reverse', committedAfterReverse);
  await attachPng(testInfo, 'build-after-reverse', abandonedAfterReverse);
  const reverseBounds = await requireRoadPreviewBounds(page);
  expect(reverseBounds.maxX).toBeLessThanOrEqual(cellMinimumX(line.active[3]!) + 0.0001);

  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  await settleRendering(page);
  const after = await readEvidence(page);
  expect(after.road.previewRootCount).toBe(0);
  expect(after.road.occupiedCellCount).toBe(4);
  const abandonedAfterCommit = await captureCellRegion(page, activePoints.at(-1)!);
  await attachPng(testInfo, 'build-after-commit', abandonedAfterCommit);
});

test('reverse then perpendicular movement branches from the retained Road tail', async ({
  page,
}, testInfo) => {
  await openGame(page);
  const path = findBranchPath();
  const allCells = [...path.forward, ...path.retained.slice(3)];
  const points = await locateCells(page, allCells);
  const forwardPoints = points.slice(0, path.forward.length);
  const branchEnd = points.at(-1)!;
  const abandonedPoint = forwardPoints.at(-1)!;

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.move(forwardPoints[0]!.x, forwardPoints[0]!.y);
  await settleRendering(page);

  await page.mouse.down();
  await page.mouse.move(forwardPoints.at(-1)!.x, forwardPoints.at(-1)!.y, { steps: 8 });
  await expectRoadCounts(page, 5);
  await page.mouse.move(forwardPoints[2]!.x, forwardPoints[2]!.y, { steps: 5 });
  await expectRoadCounts(page, 3);
  await page.mouse.move(branchEnd.x, branchEnd.y, { steps: 5 });
  await expectRoadCounts(page, 5);
  await settleRendering(page);
  const abandonedAfterBranch = await captureCellRegion(page, abandonedPoint);
  await attachPng(testInfo, 'branch-abandoned-tail', abandonedAfterBranch);
  const branchBounds = await requireRoadPreviewBounds(page);
  expect(branchBounds.maxX).toBeLessThanOrEqual(cellMinimumX(path.abandoned[0]!) + 0.0001);

  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  const after = await readEvidence(page);
  expect(after.road.occupiedCellCount).toBe(path.retained.length);
  expect(after.road.previewRootCount).toBe(0);
  const abandonedAfterCommit = await captureCellRegion(page, abandonedPoint);
  await attachPng(testInfo, 'branch-after-commit', abandonedAfterCommit);
});

test('Bulldoze reverse restores the abandoned removal tail before release', async ({
  page,
}, testInfo) => {
  await openGame(page);
  const cells = findRoadLine(6);
  const points = await locateCells(page, cells);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.move(points[0]!.x, points[0]!.y);
  await page.mouse.down();
  await page.mouse.move(points.at(-1)!.x, points.at(-1)!.y, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(6);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  await page.mouse.move(points[0]!.x, points[0]!.y);
  await settleRendering(page);
  const tailBaseline = await captureCellRegion(page, points.at(-1)!);
  await attachPng(testInfo, 'bulldoze-tail-baseline', tailBaseline);

  await page.mouse.down();
  await page.mouse.move(points.at(-1)!.x, points.at(-1)!.y, { steps: 10 });
  await settleRendering(page);
  await expectRoadCounts(page, 6);
  const tailDuringPreview = await captureCellRegion(page, points.at(-1)!);
  await attachPng(testInfo, 'bulldoze-forward-preview', tailDuringPreview);
  const forwardBounds = await requireRoadPreviewBounds(page);
  expect(forwardBounds.maxX).toBeGreaterThan(cellMinimumX(cells.at(-1)!));
  expect(Buffer.compare(tailDuringPreview, tailBaseline)).not.toBe(0);

  await page.mouse.move(points[3]!.x, points[3]!.y, { steps: 5 });
  await settleRendering(page);
  await expectRoadCounts(page, 4);
  const tailAfterReverse = await captureCellRegion(page, points.at(-1)!);
  await attachPng(testInfo, 'bulldoze-after-reverse', tailAfterReverse);
  const reverseBounds = await requireRoadPreviewBounds(page);
  expect(reverseBounds.maxX).toBeLessThanOrEqual(cellMinimumX(cells[4]!) + 0.0001);

  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road bulldozed');
  await settleRendering(page);
  const after = await readEvidence(page);
  expect(after.road.occupiedCellCount).toBe(2);
  expect(after.road.previewRootCount).toBe(0);
  const tailAfterCommit = await captureCellRegion(page, points.at(-1)!);
  await attachPng(testInfo, 'bulldoze-after-commit', tailAfterCommit);
});
