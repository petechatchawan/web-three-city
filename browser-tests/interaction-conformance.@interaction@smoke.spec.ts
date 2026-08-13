import { expect, test, type Page } from '@playwright/test';
import {
  GAME_SEED,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  deriveWaterSnapshot,
  generateCoastalTerrain,
  planRoadMutation,
  planTerraformStroke,
  rasterizeTerraformCellLine,
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

async function openGame(page: Page, width = 1440, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
}

function candidateCells(): readonly Readonly<{ x: number; z: number }>[] {
  const cells: Array<Readonly<{ x: number; z: number }>> = [];
  for (let z = 6; z < WORLD_CONFIG.mapHeight - 6; z += 1) {
    for (let x = 6; x < WORLD_CONFIG.mapWidth - 6; x += 1) cells.push({ x, z });
  }
  return cells;
}

function findAcceptedThenRoadBlockedLine(): Readonly<{
  start: Readonly<{ x: number; z: number }>;
  road: Readonly<{ x: number; z: number }>;
}> {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (const road of candidateCells()) {
    const roadPlan = planRoadMutation(
      roads,
      { operation: 'build', definitionId: 'basic-road', cells: [road] },
      BASE_ENVIRONMENT,
      WORLD_CONFIG,
    );
    if (!roadPlan.valid) continue;
    for (const offset of [-3, 3]) {
      const start = { x: road.x + offset, z: road.z };
      const traversed = rasterizeTerraformCellLine(start, road);
      if (traversed.length < 2) continue;
      const prefixesValid = traversed.slice(0, -1).every(
        (_, index) =>
          planTerraformStroke(
            BASE_TERRAIN,
            {
              operation: 'raise',
              brushSize: 1,
              cells: traversed.slice(0, index + 1),
            },
            WORLD_CONFIG,
          ).valid,
      );
      const complete = planTerraformStroke(
        BASE_TERRAIN,
        { operation: 'raise', brushSize: 1, cells: traversed },
        WORLD_CONFIG,
      );
      if (prefixesValid && complete.valid) return { start, road };
    }
  }
  throw new Error('interaction-conformance:no-accepted-then-road-blocked-line');
}

function findWetRoadCell(): Readonly<{ x: number; z: number }> {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const cell = { x, z };
      const plan = planRoadMutation(
        roads,
        { operation: 'build', definitionId: 'basic-road', cells: [cell] },
        BASE_ENVIRONMENT,
        WORLD_CONFIG,
      );
      if (!plan.valid && plan.invalidReason === 'road:wet-cell') return cell;
    }
  }
  throw new Error('interaction-conformance:no-wet-road-cell');
}

async function locatePair(
  page: Page,
  first: Readonly<{ x: number; z: number }>,
  second: Readonly<{ x: number; z: number }>,
): Promise<readonly [TerrainCellScreenPoint, TerrainCellScreenPoint]> {
  return [await clickTerrainCell(page, first), await clickTerrainCell(page, second)];
}

test('desktop HUD is map-first and separates category, context, and world controls', async ({
  page,
}) => {
  await openGame(page);
  await expect(page.locator('.city-bottom-nav')).toBeVisible();
  await expect(page.getByTestId('subtool-tray')).toBeHidden();
  await page.getByTestId('nav-terrain').click();
  await expect(page.getByTestId('subtool-tray')).toBeVisible();
  await expect(page.locator('.city-tool-context')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Game Menu' })).toBeVisible();
  const layout = await page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>('.city-awareness-hud');
    if (hud === null) throw new Error('missing City HUD');
    const rect = hud.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      visibleMapRatio: 1 - (rect.width * rect.height) / (innerWidth * innerHeight),
    };
  });
  expect(layout.overflow).toBe(false);
  expect(layout.visibleMapRatio).toBeGreaterThan(0.8);
});

test('accepted Terraform preview survives a later Road-occupied stamp', async ({ page }) => {
  await openGame(page);
  const line = findAcceptedThenRoadBlockedLine();
  const [start, road] = await locatePair(page, line.start, line.road);
  await page.getByTestId('nav-roads').click();
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(road.x, road.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(road.x, road.y, { steps: 5 });

  const preview = await readEvidence(page);
  expect(preview.terraform.acceptedStampCount).toBeGreaterThan(0);
  expect(preview.terraform.currentStampKind).toBe('rejected');
  expect(preview.terraform.previewInvalidReason).toBe('terraform:road-occupied');
  expect(preview.terraform.previewCoreCount).toBe(1);
  expect(preview.terraform.previewRejectedCount).toBe(1);
  expect(preview.terraform.previewRejectedMarkerCount).toBe(1);
  await expect(page.getByTestId('tool-context-message')).toHaveText(
    'Remove the road before changing this terrain',
  );

  await page.mouse.up();
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform applied');
  expect((await readEvidence(page)).terraform.previewRootCount).toBe(0);
});

test('a Road-blocked-only release changes neither Terrain nor Undo ownership', async ({ page }) => {
  await openGame(page);
  const line = findAcceptedThenRoadBlockedLine();
  const roadPoint = await clickTerrainCell(page, line.road);
  await page.getByTestId('nav-roads').click();
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(roadPoint.x, roadPoint.y);
  const before = await readEvidence(page);
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();

  await page.mouse.click(roadPoint.x, roadPoint.y);
  await expect(page.getByTestId('tool-context-message')).toHaveText(
    'Remove the road before changing this terrain',
  );
  const after = await readEvidence(page);
  expect(after.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
  expect(after.road.undoKind).toBe('road');
  expect(after.terraform.previewRootCount).toBe(0);
});

test('invalid Road preview exposes a non-color marker and reason', async ({ page }) => {
  await openGame(page);
  const point = await clickTerrainCell(page, findWetRoadCell());
  await page.getByTestId('nav-roads').click();
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();

  const evidence = await readEvidence(page);
  expect(evidence.road.previewValid).toBe(false);
  expect(evidence.road.previewRootCount).toBe(1);
  expect(evidence.road.invalidMarkerCount).toBe(1);
  await expect(page.getByTestId('tool-context-message')).toHaveText(
    'Roads cannot be placed on water',
  );

  await page.mouse.up();
});

test('Escape cancels a preview before closing the active tool', async ({ page }) => {
  await openGame(page);
  const line = findAcceptedThenRoadBlockedLine();
  const point = await clickTerrainCell(page, line.start);
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  expect((await readEvidence(page)).terraform.previewRootCount).toBe(1);

  await page.keyboard.press('Escape');
  const afterCancel = await readEvidence(page);
  expect(afterCancel.terraform.previewRootCount).toBe(0);
  expect(afterCancel.terraform.committedTerrainRevision).toBe(
    before.terraform.committedTerrainRevision,
  );
  await expect(page.getByTestId('tool-context-name')).toHaveText('Raise');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tool-context-name')).toHaveText('Navigate');
});

test('responsive compatibility keeps tools reachable without horizontal overflow', async ({
  page,
}) => {
  await openGame(page, 390, 844);
  await expect(page.locator('.city-bottom-nav')).toBeVisible();
  await expect(page.getByTestId('nav-terrain')).toBeVisible();
  await expect(page.locator('.city-tool-context')).toBeVisible();
  const layout = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    hudHeight:
      document.querySelector<HTMLElement>('.city-awareness-hud')?.getBoundingClientRect().height ??
      0,
  }));
  expect(layout.horizontalOverflow).toBe(false);
  expect(layout.hudHeight).toBeLessThan(844 * 0.3);
  await page.getByTestId('nav-terrain').click();
  await page.getByRole('button', { name: 'Raise' }).click();
  await expect(page.getByRole('button', { name: 'Brush 1 × 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Brush 5 × 5' })).toBeVisible();
});
