import { expect, test, type Page } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { prepareDeterministicGrowthClock, stepLogicalTicks } from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

const SAVE_KEY = 'web-three-city:world-save:v6';
const EXPECTED_DEFINITION_IDS = Object.freeze([
  'commercial-cafe-1x1',
  'commercial-shop-1x1',
  'industrial-depot-1x1',
]);

type SavedBuildingInstance = Readonly<{
  buildingDefinitionId: string;
  originCell: Readonly<{ x: number; z: number }>;
}>;

type SavedWorldFixture = Readonly<{
  buildings?: Readonly<{
    instances?: readonly SavedBuildingInstance[];
  }>;
}>;

function findTerraformSupportCell(
  originCell: SavedBuildingInstance['originCell'],
): SavedBuildingInstance['originCell'] {
  const zoneCells = BUILDING_FIXTURES.commercial.zoneCells;
  const backRowZ = Math.max(...zoneCells.map((cell) => cell.z));
  const supportCell =
    originCell.z === backRowZ
      ? zoneCells.find((cell) => cell.z === backRowZ && cell.x !== originCell.x)
      : zoneCells.find((cell) => cell.z === backRowZ && cell.x === originCell.x);
  if (supportCell === undefined) {
    throw new Error(`building:missing-terraform-support:${originCell.x}:${originCell.z}`);
  }
  return supportCell;
}

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

async function saveWorldFixture(page: Page): Promise<SavedWorldFixture> {
  await page.getByRole('button', { name: 'Save world' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  return JSON.parse(saved ?? '{}') as SavedWorldFixture;
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

test('grows deterministic R/C/I content and preserves authority across guards, Undo, and Save V5', async ({
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
  expect(evidence.building.occupiedCellCount).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.commitCount).toBe(3);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
  await expect(page.getByTestId('building-count')).toHaveText('3');

  await setAutomaticGrowthEnabled(page, false);
  const parsedSave = await saveWorldFixture(page);
  expect(parsedSave).toMatchObject({
    kind: 'world-save',
    schemaVersion: 6,
    buildings: {
      kind: 'building-save',
      schemaVersion: 2,
      instances: expect.arrayContaining([
        expect.objectContaining({ buildingDefinitionId: 'commercial-cafe-1x1' }),
        expect.objectContaining({ buildingDefinitionId: 'commercial-shop-1x1' }),
        expect.objectContaining({ buildingDefinitionId: 'industrial-depot-1x1' }),
      ]),
    },
  });
  const commercialInstance = parsedSave.buildings?.instances?.find((instance) =>
    instance.buildingDefinitionId.startsWith('commercial-'),
  );
  if (commercialInstance === undefined) {
    throw new Error('building:missing-commercial-instance');
  }
  const commercialOccupiedCell = pointFor(points, commercialInstance.originCell);
  const commercialSupportCell = pointFor(
    points,
    findTerraformSupportCell(commercialInstance.originCell),
  );
  const bulldozedDefinitionId = commercialInstance.buildingDefinitionId;

  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(commercialOccupiedCell.x, commercialOccupiedCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road blocked by building');

  await page.getByRole('button', { name: 'Remove Zone' }).click();
  await page.mouse.click(commercialOccupiedCell.x, commercialOccupiedCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zone blocked by building');

  // Always use a rear-row fixture cell whose Terraform vertex support touches the occupied 1x1
  // Building without also touching the frontage Road. Road occupancy has higher precedence.
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.click(commercialSupportCell.x, commercialSupportCell.y);
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

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialOccupiedCell.x, commercialOccupiedCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(2);
  expect(evidence.building.occupiedCellCount).toBe(2);
  expect(evidence.building.definitionIds).not.toContain(bulldozedDefinitionId);
  expect(evidence.zone.counts.commercial).toBe(4);

  await page.getByRole('button', { name: 'Undo latest world change' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Building undone');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.undoCount).toBe(1);

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialOccupiedCell.x, commercialOccupiedCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});
