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
import { GAME_URL, clickTerrainCell, readEvidence } from './helpers/interaction.js';

const TERRAIN = (() => {
  const result = generateCoastalTerrain({ seed: GAME_SEED, config: WORLD_CONFIG });
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

function findValidRoadCell(): Readonly<{ x: number; z: number }> {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 8; x += 1) {
      const cell = Object.freeze({ x, z });
      const plan = planRoadMutation(
        roads,
        { operation: 'build', definitionId: 'basic-road', cells: [cell] },
        ENVIRONMENT,
        WORLD_CONFIG,
      );
      if (plan.valid) return cell;
    }
  }
  throw new Error('transaction-release:no-valid-road-cell');
}

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

test('Road pointer capture released outside the map commits the latest valid plan once', async ({
  page,
}) => {
  await openGame(page);
  const point = await clickTerrainCell(page, findValidRoadCell());
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  const before = await readEvidence(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  expect((await readEvidence(page)).road.previewValid).toBe(true);

  await page.mouse.move(2, 2);
  await page.mouse.up();

  const after = await readEvidence(page);
  expect(after.road.previewRootCount).toBe(0);
  expect(after.road.commitCount).toBe(before.road.commitCount + 1);
  expect(after.road.committedRoadRevision).toBe(before.road.committedRoadRevision + 1);
  expect(after.road.occupiedCellCount).toBe(before.road.occupiedCellCount + 1);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  await expect(page.getByRole('button', { name: 'Build Road' })).toBeEnabled();
  await expect(page.getByTestId('tool-context-state')).not.toHaveText('Applying change');
});
