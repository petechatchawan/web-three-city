import { expect, test, type Page } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v3';
const EXPECTED_DEFINITION_IDS = Object.freeze([
  'commercial-office-2x2',
  'industrial-warehouse-2x2',
  'residential-apartment-2x2',
]);

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await prepareDeterministicGrowthClock(page);
}

async function growAllEligibleBuildings(page: Page): Promise<void> {
  const snapshot = await stepLogicalTicks(page, 16);
  expect(snapshot.simulation.absoluteTick).toBe(24);
  expect(snapshot.buildingCount).toBe(3);
  await expect(page.getByTestId('building-count')).toHaveText('3');
}

async function setAutomaticGrowthEnabled(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((value) => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: {
        setAutomaticGrowthEnabled(enabled: boolean): void;
      };
    };
    const api = timeWindow.__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('building:missing-time-api');
    api.setAutomaticGrowthEnabled(value);
  }, enabled);
}

test('exposes headless Building Growth and interactive Bulldoze evidence', async ({ page }) => {
  await openGame(page);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
  await expect(page.getByTestId('building-count')).toHaveText('0');
  const evidence = await readEvidence(page);
  expect(evidence.building.committedBuildingRevision).toBe(0);
  expect(evidence.building.count).toBe(0);
  expect(evidence.building.definitionIds).toEqual([]);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('headless Growth fails closed before eligible Zones exist', async ({ page }) => {
  await openGame(page);
  const statusBeforeGrowth = (await page.getByTestId('game-status').textContent()) ?? '';
  const snapshot = await stepLogicalTicks(page, 4);

  expect(snapshot.simulation.absoluteTick).toBe(12);
  expect(snapshot.buildingCount).toBe(0);
  await expect(page.getByTestId('building-count')).toHaveText('0');
  await expect(page.getByTestId('active-tool')).toHaveText('Navigate');
  await expect(page.getByTestId('game-status')).toHaveText(statusBeforeGrowth);
  await expect(page.getByTestId('game-status')).not.toHaveText('Zones developed');
});

test('grows deterministic R/C/I content and preserves authority across guards, Undo, and Save V3', async ({
  page,
}) => {
  await openGame(page);
  const points = await prepareBuildingFixtureWorld(page);
  await growAllEligibleBuildings(page);

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
  expect(evidence.building.commitCount).toBe(3);
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

  await setAutomaticGrowthEnabled(page, false);
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
        expect.objectContaining({ buildingDefinitionId: 'industrial-warehouse-2x2' }),
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
