import { expect, test, type Page } from '@playwright/test';
import {
  ROAD_PLACEMENT_ENVIRONMENT,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  planRoadMutation,
  type CellCoord,
} from './helpers/domain-fixtures.js';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { GAME_URL, clickTerrainCell, readEvidence } from './helpers/interaction.js';

function findValidRoadCell(): CellCoord {
  const roads = createEmptyRoadSnapshot(WORLD_CONFIG);
  for (let z = 4; z < WORLD_CONFIG.mapHeight - 4; z += 1) {
    for (let x = 4; x < WORLD_CONFIG.mapWidth - 4; x += 1) {
      const cell = Object.freeze({ x, z });
      const plan = planRoadMutation(
        roads,
        { operation: 'build', definitionId: 'basic-road', cells: [cell] },
        ROAD_PLACEMENT_ENVIRONMENT,
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
  const buildRoad = page.getByRole('button', { name: 'Build Road' });
  await buildRoad.click();
  const before = await readEvidence(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  expect((await readEvidence(page)).road.previewValid).toBe(true);

  await page.mouse.move(2, 2);
  await page.mouse.up();

  const after = await readEvidence(page);
  expect(after.road.previewRootCount).toBe(0);
  expect(after.road.strokeActive).toBe(false);
  expect(after.road.commitCount).toBe(before.road.commitCount + 1);
  expect(after.road.committedRoadRevision).toBe(before.road.committedRoadRevision + 1);
  expect(after.road.occupiedCellCount).toBe(before.road.occupiedCellCount + 1);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
  await expect(buildRoad).toBeEnabled();
  await expect(buildRoad).toHaveAttribute('aria-pressed', 'true');
});
