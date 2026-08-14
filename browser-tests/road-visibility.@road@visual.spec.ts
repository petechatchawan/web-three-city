import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { expect, test, type Page } from '@playwright/test';
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
import { GAME_URL, clickTerrainCell, type TerrainCellScreenPoint } from './helpers/interaction.js';

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

function findVisibleRoadCell(): CellCoord {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  const centerX = WORLD_CONFIG.mapWidth / 2;
  const centerZ = WORLD_CONFIG.mapHeight / 2;
  const cells: CellCoord[] = [];
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 8; x += 1) cells.push({ x, z });
  }
  cells.sort(
    (first, second) =>
      (first.x - centerX) ** 2 +
        (first.z - centerZ) ** 2 -
        ((second.x - centerX) ** 2 + (second.z - centerZ) ** 2) ||
      first.z - second.z ||
      first.x - second.x,
  );

  for (const cell of cells) {
    const plan = planRoadMutation(
      roads,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      BASE_ENVIRONMENT,
      WORLD_CONFIG,
    );
    if (plan.valid) return Object.freeze({ ...cell });
  }
  throw new Error('road-visibility:no-valid-cell');
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
  if (viewport === null) throw new Error('road-visibility:missing-viewport');
  const radius = 24;
  const x = Math.max(0, Math.min(viewport.width - radius * 2, point.x - radius));
  const y = Math.max(0, Math.min(viewport.height - radius * 2, point.y - radius));
  return page.screenshot({ clip: { x, y, width: radius * 2, height: radius * 2 } });
}

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

test('Road Preview and committed Road change visible pixels at the target cell', async ({
  page,
}) => {
  await openGame(page);
  const cell = findVisibleRoadCell();
  const point = await clickTerrainCell(page, cell);
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.move(point.x, point.y);
  await settleRendering(page);
  const before = await captureCellRegion(page, point);

  await page.mouse.down();
  await settleRendering(page);
  const preview = await captureCellRegion(page, point);
  expect(Buffer.compare(preview, before)).not.toBe(0);

  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  await settleRendering(page);
  const committed = await captureCellRegion(page, point);
  expect(Buffer.compare(committed, before)).not.toBe(0);
  expect(Buffer.compare(committed, preview)).not.toBe(0);
});
