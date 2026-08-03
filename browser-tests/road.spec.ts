import { expect, test, type Page } from '@playwright/test';
import {
  createEmptyRoadSnapshot,
  planRoadMutation,
  type RoadPlacementEnvironment,
} from '../packages/road-core/src/index.js';
import {
  encodeTerrainSaveV1,
  planTerraformStroke,
  terrainCellSurfaceProfile,
} from '../packages/terrain-core/src/index.js';
import { generateCoastalTerrain } from '../packages/terrain-generator/src/index.js';
import { deriveWaterSnapshot, triangleIndexFor } from '../packages/water-core/src/index.js';
import { WORLD_CONFIG, type CellCoord } from '../packages/world-core/src/index.js';
import {
  GAME_URL,
  TERRAIN_LAB_URL,
  clickTerrainCell,
  dispatchCanvasTouch,
  readEvidence,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

const WORLD_SAVE_KEY = 'web-three-city:world-save:v2';
const LEGACY_SAVE_KEY = 'web-three-city:terrain-save:v1';
const GAME_SEED = 1_464_156_977;
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

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

function interiorCells(): readonly Readonly<{ x: number; z: number }>[] {
  const cells: Array<Readonly<{ x: number; z: number }>> = [];
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 8; x += 1) cells.push({ x, z });
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

function findRoadLine(length = 4): readonly Readonly<{ x: number; z: number }>[] {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (const start of interiorCells()) {
    const cells = Array.from({ length }, (_, index) => ({ x: start.x + index, z: start.z }));
    if (cells.at(-1)!.x >= WORLD_CONFIG.mapWidth - 4) continue;
    const plan = planRoadMutation(
      roads,
      { operation: 'build', definitionId: 'basic-road', cells },
      BASE_ENVIRONMENT,
      WORLD_CONFIG,
    );
    if (plan.valid) return cells;
  }
  throw new Error('road-browser:no-valid-line');
}

function findRoadAndRaiseCell(): Readonly<{ x: number; z: number }> {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (const cell of interiorCells()) {
    const roadPlan = planRoadMutation(
      roads,
      { operation: 'build', definitionId: 'basic-road', cells: [cell] },
      BASE_ENVIRONMENT,
      WORLD_CONFIG,
    );
    const terraformPlan = planTerraformStroke(
      BASE_TERRAIN,
      { operation: 'raise', brushSize: 1, cells: [cell] },
      WORLD_CONFIG,
    );
    if (roadPlan.valid && terraformPlan.valid) return cell;
  }
  throw new Error('road-browser:no-road-and-raise-cell');
}

async function locateCells(
  page: Page,
  cells: readonly Readonly<{ x: number; z: number }>[],
): Promise<readonly TerrainCellScreenPoint[]> {
  const points: TerrainCellScreenPoint[] = [];
  for (const cell of cells) points.push(await clickTerrainCell(page, cell));
  return points;
}

async function buildRoadTap(page: Page, cell: Readonly<{ x: number; z: number }>): Promise<void> {
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road built');
}

interface TerrainLabRoadEvidence {
  readonly fixture: string;
  readonly valid: boolean;
  readonly invalidReason: string | null;
  readonly roadRevision: number;
  readonly occupiedCellCount: number;
  readonly connectionMask: number;
  readonly requestedCellCount: number;
  readonly dirtyChunkCount: number;
  readonly committedRootCount: number;
  readonly previewRootCount: number;
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly estimatedGeometryBytes: number;
}

async function readRoadFixture(page: Page): Promise<TerrainLabRoadEvidence> {
  return page.evaluate(() => {
    const evidence = window.__WEB_THREE_CITY_ROAD_EVIDENCE__;
    if (evidence === undefined) throw new Error('missing Road fixture evidence');
    return evidence;
  });
}

const VALID_FIXTURES = [
  'road-isolated',
  'road-end-north',
  'road-end-east',
  'road-end-south',
  'road-end-west',
  'road-straight-ns',
  'road-straight-ew',
  'road-corner-ne',
  'road-corner-es',
  'road-corner-sw',
  'road-corner-wn',
  'road-t-north',
  'road-t-east',
  'road-t-south',
  'road-t-west',
  'road-four-way',
  'road-ramp-north-up',
  'road-ramp-north-down',
  'road-ramp-east-up',
  'road-ramp-east-down',
  'road-chunk-boundary',
] as const;

for (const fixture of VALID_FIXTURES) {
  test(`renders valid ${fixture} deterministically`, async ({ page }) => {
    await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
    const evidence = await readRoadFixture(page);
    expect(evidence.fixture).toBe(fixture);
    expect(evidence.valid).toBe(true);
    expect(evidence.invalidReason).toBeNull();
    expect(evidence.roadRevision).toBe(1);
    expect(evidence.occupiedCellCount).toBeGreaterThan(0);
    expect(evidence.committedRootCount).toBe(1);
    expect(evidence.previewRootCount).toBe(0);
    expect(evidence.terrainRevision).toBe(evidence.waterSourceTerrainRevision);
    expect(evidence.estimatedGeometryBytes).toBeGreaterThan(0);
    if (fixture === 'road-chunk-boundary') expect(evidence.dirtyChunkCount).toBeGreaterThan(1);
  });
}

for (const [fixture, reason] of [
  ['road-invalid-ramp-perpendicular', 'road:invalid-ramp-topology'],
  ['road-invalid-ramp-junction', 'road:invalid-ramp-topology'],
  ['road-invalid-wet', 'road:wet-cell'],
] as const) {
  test(`renders invalid ${fixture} Preview`, async ({ page }) => {
    await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
    const evidence = await readRoadFixture(page);
    expect(evidence.valid).toBe(false);
    expect(evidence.invalidReason).toBe(reason);
    expect(evidence.roadRevision).toBe(0);
    expect(evidence.occupiedCellCount).toBe(0);
    expect(evidence.committedRootCount).toBe(1);
    expect(evidence.previewRootCount).toBe(1);
  });
}

test('desktop drag previews and commits one Road transaction without touching Water', async ({
  page,
}) => {
  await openGame(page);
  const cells = findRoadLine();
  const points = await locateCells(page, [cells[0]!, cells.at(-1)!]);
  await page.getByRole('button', { name: 'Build Road' }).click();
  const before = await readEvidence(page);

  await page.mouse.move(points[0]!.x, points[0]!.y);
  await page.mouse.down();
  await page.mouse.move(points[1]!.x, points[1]!.y, { steps: 5 });
  const preview = await readEvidence(page);
  expect(preview.road.strokeActive).toBe(true);
  expect(preview.road.previewValid).toBe(true);
  expect(preview.road.previewCellCount).toBeGreaterThanOrEqual(cells.length);
  expect(preview.road.previewRootCount).toBe(1);
  expect(preview.road.committedRoadRevision).toBe(before.road.committedRoadRevision);

  await page.mouse.up();
  await expect(page.getByTestId('game-status')).toHaveText('Road built');
  const after = await readEvidence(page);
  expect(after.road.committedRoadRevision).toBe(before.road.committedRoadRevision + 1);
  expect(after.road.occupiedCellCount).toBe(cells.length);
  expect(after.road.commitCount).toBe(before.road.commitCount + 1);
  expect(after.road.previewRootCount).toBe(0);
  expect(after.road.lastDirtyChunkCount).toBeGreaterThan(0);
  expect(after.water.sourceTerrainRevision).toBe(before.water.sourceTerrainRevision);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount);
  expect(after.road.undoKind).toBe('road');
});

test('Bulldoze updates topology and tagged Undo restores the Road only', async ({ page }) => {
  await openGame(page);
  const cells = findRoadLine(3);
  const points = await locateCells(page, [cells[0]!, cells.at(-1)!]);
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.move(points[0]!.x, points[0]!.y);
  await page.mouse.down();
  await page.mouse.move(points[1]!.x, points[1]!.y, { steps: 4 });
  await page.mouse.up();
  const built = await readEvidence(page);

  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  await page.mouse.click(points[1]!.x, points[1]!.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road bulldozed');
  const bulldozed = await readEvidence(page);
  expect(bulldozed.road.occupiedCellCount).toBe(built.road.occupiedCellCount - 1);
  expect(bulldozed.road.bulldozeCount).toBe(built.road.bulldozeCount + 1);
  expect(bulldozed.water.sourceTerrainRevision).toBe(built.water.sourceTerrainRevision);

  await page.getByRole('button', { name: 'Undo latest world change' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Road undone');
  const undone = await readEvidence(page);
  expect(undone.road.occupiedCellCount).toBe(built.road.occupiedCellCount);
  expect(undone.road.committedRoadRevision).toBeGreaterThan(bulldozed.road.committedRoadRevision);
  expect(undone.road.undoCount).toBe(bulldozed.road.undoCount + 1);
  expect(undone.water.sourceTerrainRevision).toBe(built.water.sourceTerrainRevision);
});

test('second touch cancels Road Preview and transfers to camera gesture ownership', async ({
  page,
}) => {
  await openGame(page);
  const cell = findRoadLine(1)[0]!;
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Build Road' }).click();
  const before = await readEvidence(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, point.x, point.y);
  expect((await readEvidence(page)).road.previewRootCount).toBe(1);
  await dispatchCanvasTouch(page, 'pointerdown', 2, point.x + 120, point.y);
  for (const offset of [12, 24, 36]) {
    await dispatchCanvasTouch(page, 'pointermove', 1, point.x - offset, point.y);
    await dispatchCanvasTouch(page, 'pointermove', 2, point.x + 120 + offset, point.y);
  }
  const transferred = await readEvidence(page);
  expect(transferred.road.previewRootCount).toBe(0);
  expect(transferred.road.commitCount).toBe(before.road.commitCount);
  expect(transferred.road.committedRoadRevision).toBe(before.road.committedRoadRevision);

  await dispatchCanvasTouch(page, 'pointerup', 1, point.x - 36, point.y);
  await dispatchCanvasTouch(page, 'pointerup', 2, point.x + 156, point.y);
  expect((await readEvidence(page)).activePointerCount).toBe(0);
});

test('Terraform touching one Road cell invalidates Preview and rejects the whole transaction', async ({
  page,
}) => {
  await openGame(page);
  const cell = findRoadAndRaiseCell();
  await buildRoadTap(page, cell);
  const before = await readEvidence(page);
  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Raise' }).click();

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const preview = await readEvidence(page);
  expect(preview.terraform.previewValid).toBe(false);
  expect(preview.terraform.previewInvalidReason).toBe('terraform:road-occupied');
  expect(preview.terraform.previewRootCount).toBe(1);
  await page.mouse.up();

  await expect(page.getByTestId('game-status')).toHaveText('Terraform blocked by road');
  const after = await readEvidence(page);
  expect(after.terraform.previewRootCount).toBe(0);
  expect(after.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount);
  expect(after.road.committedRoadRevision).toBe(before.road.committedRoadRevision);
  expect(after.road.occupiedCellCount).toBe(before.road.occupiedCellCount);
  expect(after.road.undoKind).toBe('road');
});

test('WorldSaveV1 restores Roads and legacy Terrain saves migrate to empty Roads', async ({
  page,
}) => {
  await openGame(page);
  const cell = findRoadLine(1)[0]!;
  await buildRoadTap(page, cell);
  await page.getByRole('button', { name: 'Save world' }).click();
  const worldSave = await page.evaluate((key) => localStorage.getItem(key), WORLD_SAVE_KEY);
  expect(worldSave).not.toBeNull();

  const point = await clickTerrainCell(page, cell);
  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  await page.mouse.click(point.x, point.y);
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(0);
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(1);

  await page.evaluate(
    ({ worldKey, legacyKey, legacy }) => {
      localStorage.removeItem(worldKey);
      localStorage.setItem(legacyKey, legacy);
    },
    {
      worldKey: WORLD_SAVE_KEY,
      legacyKey: LEGACY_SAVE_KEY,
      legacy: JSON.stringify(encodeTerrainSaveV1(BASE_TERRAIN)),
    },
  );
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  const migrated = await readEvidence(page);
  expect(migrated.road.occupiedCellCount).toBe(0);
  expect(migrated.road.committedRoadRevision).toBe(0);
});

test('WebGL context restoration keeps committed Roads and clears Preview', async ({ page }) => {
  await openGame(page);
  const cells = findRoadLine(2);
  const [committedPoint, previewPoint] = await locateCells(page, cells);
  if (committedPoint === undefined || previewPoint === undefined) {
    throw new Error('road-browser:missing-context-restore-points');
  }
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(committedPoint.x, committedPoint.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road built');
  await dispatchCanvasTouch(page, 'pointerdown', 1, previewPoint.x, previewPoint.y);
  expect((await readEvidence(page)).road.previewRootCount).toBe(1);

  const canvas = page.locator('#game-canvas');
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    element.dispatchEvent(new Event('webglcontextrestored'));
  });
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  const restored = await readEvidence(page);
  expect(restored.road.occupiedCellCount).toBe(1);
  expect(restored.road.committedRootCount).toBe(1);
  expect(restored.road.previewRootCount).toBe(0);
  expect(restored.sceneRootCounts.roadCommitted).toBe(1);
});
