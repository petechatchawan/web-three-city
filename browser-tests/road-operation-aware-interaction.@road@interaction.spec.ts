import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
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
  dispatchCanvasTouch,
  readEvidence,
} from './helpers/interaction.js';

test.describe.configure({ timeout: 90_000 });

const TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();
const WATER = (() => {
  const result = deriveWaterSnapshot(TERRAIN, WORLD_CONFIG);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
})();
const ENVIRONMENT: RoadPlacementEnvironment = Object.freeze({
  terrainRevision: TERRAIN.revision,
  waterSourceTerrainRevision: WATER.sourceTerrainRevision,
  surfaceAt(cell: CellCoord) {
    return terrainCellSurfaceProfile(TERRAIN, cell, WORLD_CONFIG);
  },
  isDry(cell: CellCoord) {
    const first = triangleIndexFor(cell.x, cell.z, 0, WORLD_CONFIG.mapWidth);
    const second = triangleIndexFor(cell.x, cell.z, 1, WORLD_CONFIG.mapWidth);
    return WATER.seaTriangleMask[first] === 0 && WATER.seaTriangleMask[second] === 0;
  },
});

function findLine(): readonly CellCoord[] {
  for (let z = 20; z < WORLD_CONFIG.mapHeight - 20; z += 1) {
    for (let x = 20; x < WORLD_CONFIG.mapWidth - 24; x += 1) {
      const cells = Array.from({ length: 4 }, (_, index) => ({ x: x + index, z }));
      const plan = planRoadMutation(
        createEmptyRoadSnapshot(WORLD_CONFIG),
        { operation: 'build', definitionId: 'basic-road', cells },
        ENVIRONMENT,
        WORLD_CONFIG,
      );
      if (plan.valid) return Object.freeze(cells);
    }
  }
  throw new Error('operation-aware:no-valid-line');
}

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

async function attachViewport(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test('Road operations expose distinct Preview and release outside Terrain commits the latest plan', async ({
  page,
}, testInfo) => {
  await openGame(page);
  const cells = findLine();
  const points = [];
  for (const cell of cells) points.push(await clickTerrainCell(page, cell));

  await page.getByRole('button', { name: 'Build Road' }).click();
  await dispatchCanvasTouch(page, 'pointerdown', 1, points[0]!.x, points[0]!.y);
  await dispatchCanvasTouch(page, 'pointermove', 1, points.at(-1)!.x, points.at(-1)!.y);
  await expect(page.getByTestId('tool-context-state')).toHaveText('Valid build');
  await attachViewport(page, testInfo, 'valid-build-preview');
  await dispatchCanvasTouch(page, 'pointerup', 1, 20, 450);
  await expect(page.getByTestId('game-status')).toHaveText('Road built');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(cells.length);

  await dispatchCanvasTouch(page, 'pointerdown', 2, points[0]!.x, points[0]!.y);
  await expect(page.getByTestId('tool-context-state')).toHaveText('Invalid build');
  expect((await readEvidence(page)).road.invalidMarkerCount).toBe(1);
  await attachViewport(page, testInfo, 'invalid-build-preview');
  await dispatchCanvasTouch(page, 'pointerup', 2, points[0]!.x, points[0]!.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road unchanged');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(cells.length);

  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  await dispatchCanvasTouch(page, 'pointerdown', 3, points[0]!.x, points[0]!.y);
  await dispatchCanvasTouch(page, 'pointermove', 3, points.at(-1)!.x, points.at(-1)!.y);
  await expect(page.getByTestId('tool-context-state')).toHaveText('Valid bulldoze');
  expect((await readEvidence(page)).road.bulldozeMarkerCount).toBe(1);
  await attachViewport(page, testInfo, 'valid-bulldoze-preview');
  await dispatchCanvasTouch(page, 'pointerup', 3, points.at(-1)!.x, points.at(-1)!.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road bulldozed');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(0);
});

test('camera pan remains screen-relative after every quarter-turn rotation', async ({
  page,
}, testInfo) => {
  await openGame(page);
  const rotateRight = page.getByRole('button', { name: 'Rotate right' });
  const reset = page.getByRole('button', { name: 'Reset camera' });
  for (let turns = 0; turns < 4; turns += 1) {
    await reset.click();
    for (let index = 0; index < turns; index += 1) await rotateRight.click();
    const beforeRight = (await readEvidence(page)).camera;
    await page.mouse.move(900, 500);
    await page.mouse.down();
    await page.mouse.move(980, 500, { steps: 6 });
    await page.mouse.up();
    const afterRight = (await readEvidence(page)).camera;
    const yaw = (beforeRight.yawDegrees * Math.PI) / 180;
    const deltaX = afterRight.targetX - beforeRight.targetX;
    const deltaZ = afterRight.targetZ - beforeRight.targetZ;
    const expectedX = -Math.cos(yaw);
    const expectedZ = Math.sin(yaw);
    expect(deltaX * expectedX + deltaZ * expectedZ).toBeGreaterThan(0);
    expect(Math.abs(deltaX * expectedZ - deltaZ * expectedX)).toBeLessThan(0.01);

    await reset.click();
    for (let index = 0; index < turns; index += 1) await rotateRight.click();
    const beforeUp = (await readEvidence(page)).camera;
    await page.mouse.move(900, 550);
    await page.mouse.down();
    await page.mouse.move(900, 470, { steps: 6 });
    await page.mouse.up();
    const afterUp = (await readEvidence(page)).camera;
    const upDeltaX = afterUp.targetX - beforeUp.targetX;
    const upDeltaZ = afterUp.targetZ - beforeUp.targetZ;
    const expectedUpX = Math.sin(yaw);
    const expectedUpZ = Math.cos(yaw);
    expect(upDeltaX * expectedUpX + upDeltaZ * expectedUpZ).toBeGreaterThan(0);
    expect(Math.abs(upDeltaX * expectedUpZ - upDeltaZ * expectedUpX)).toBeLessThan(0.01);
  }
  await attachViewport(page, testInfo, 'camera-pan-after-rotations');
});
