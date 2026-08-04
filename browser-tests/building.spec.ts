import { expect, test, type Page } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
  type BuildingFixturePoints,
} from './helpers/building-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v3';
const EXPECTED_DEFINITION_IDS = Object.freeze([
  'commercial-office-2x2',
  'industrial-factory-2x2',
  'residential-apartment-2x2',
]);

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
}

async function develop(page: Page, points: BuildingFixturePoints): Promise<void> {
  await page.getByRole('button', { name: 'Develop Zones' }).click();
  const trigger = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[0]);
  await page.mouse.click(trigger.x, trigger.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zones developed');
}

test('exposes Building Foundation controls and authoritative evidence', async ({ page }) => {
  await openGame(page);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
  await expect(page.getByTestId('building-count')).toHaveText('0');
  const evidence = await readEvidence(page);
  expect(evidence.building.committedBuildingRevision).toBe(0);
  expect(evidence.building.count).toBe(0);
  expect(evidence.building.definitionIds).toEqual([]);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('Develop Zones fails closed before eligible Zones exist', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Develop Zones' }).click();
  await page.locator('#game-canvas').click({ position: { x: 700, y: 450 } });
  await expect(page.getByTestId('game-status')).toHaveText('No eligible Zoned lots');
});

test('develops deterministic R/C/I content and preserves authority across guards, Undo, and Save V3', async ({
  page,
}) => {
  await openGame(page);
  const points = await prepareBuildingFixtureWorld(page);
  await develop(page, points);

  let evidence = await readEvidence(page);
  expect(evidence.zone.counts).toEqual({
    residential: 4,
    commercial: 4,
    industrial: 4,
    total: 12,
  });
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.occupiedCellCount).toBe(12);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.commitCount).toBe(1);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
  await expect(page.getByTestId('building-count')).toHaveText('3');

  const commercialFrontCell = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[0]);
  const commercialBackCell = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[2]);

  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road blocked by building');

  await page.getByRole('button', { name: 'Remove Zone' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zone blocked by building');

  // Use the back row of the 2x2 footprint so the Terraform vertex set touches the Building
  // without also touching its frontage Road. Road occupancy has intentionally higher precedence.
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.click(commercialBackCell.x, commercialBackCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Terraform blocked by building');

  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  const firstRoad = pointFor(points, BUILDING_FIXTURES.commercial.roadCells[0]);
  const secondRoad = pointFor(points, BUILDING_FIXTURES.commercial.roadCells[1]);
  await page.mouse.move(firstRoad.x, firstRoad.y);
  await page.mouse.down();
  await page.mouse.move(secondRoad.x, secondRoad.y);
  await page.mouse.up();
  await expect(page.getByTestId('game-status')).toHaveText('Road required by building');

  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.zone.counts.commercial).toBe(4);

  await page.getByRole('button', { name: 'Save world' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    kind: 'world-save',
    schemaVersion: 3,
    buildings: {
      kind: 'building-save',
      schemaVersion: 1,
      instances: expect.arrayContaining([
        expect.objectContaining({ buildingDefinitionId: 'commercial-office-2x2' }),
        expect.objectContaining({ buildingDefinitionId: 'industrial-factory-2x2' }),
        expect.objectContaining({ buildingDefinitionId: 'residential-apartment-2x2' }),
      ]),
    },
  });

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(2);
  expect(evidence.building.occupiedCellCount).toBe(8);
  expect(evidence.building.definitionIds).not.toContain('commercial-office-2x2');
  expect(evidence.zone.counts.commercial).toBe(4);

  await page.getByRole('button', { name: 'Undo latest world change' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Building undone');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.undoCount).toBe(1);

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});
