import { clickToolUndo, openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { expect, test, type Page } from '@playwright/test';
import {
  EMPTY_WORLD_OCCUPANCY,
  GAME_TERRAIN,
  GAME_WATER,
  ROAD_PLACEMENT_ENVIRONMENT,
  WORLD_CONFIG,
  createEmptyRoadSnapshot,
  createEmptyZoneSnapshot,
  createRoadSnapshot,
  createZonePlacementEnvironment,
  planRoadMutation,
  planZoneMutation,
  type CellCoord,
} from './helpers/domain-fixtures.js';
import {
  GAME_URL,
  clickGameMenuAction,
  clickTerrainCell,
  dispatchCanvasTouch,
  readEvidence,
  readZoningCounts,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v6';
const TERRAIN = GAME_TERRAIN;
const WATER = GAME_WATER;
const ROAD_ENVIRONMENT = ROAD_PLACEMENT_ENVIRONMENT;
const EMPTY_OCCUPANCY = EMPTY_WORLD_OCCUPANCY;

interface ZoningFixture {
  readonly road: CellCoord;
  readonly depth: readonly [CellCoord, CellCoord, CellCoord, CellCoord];
  readonly commercial: CellCoord;
  readonly industrial: CellCoord;
}

const DIRECTIONS = Object.freeze([
  Object.freeze({ x: 0, z: -1 }),
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: -1, z: 0 }),
]);

function add(cell: CellCoord, direction: CellCoord, distance: number): CellCoord {
  return Object.freeze({
    x: cell.x + direction.x * distance,
    z: cell.z + direction.z * distance,
  });
}

function fixture(): ZoningFixture {
  const emptyRoads = createEmptyRoadSnapshot(WORLD_CONFIG);
  const emptyZones = createEmptyZoneSnapshot(WORLD_CONFIG);
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 8; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 8; x += 1) {
      const road = Object.freeze({ x, z });
      const roadPlan = planRoadMutation(
        emptyRoads,
        { operation: 'build', definitionId: 'basic-road', cells: [road] },
        ROAD_ENVIRONMENT,
        WORLD_CONFIG,
      );
      if (!roadPlan.valid) continue;
      const roads = createRoadSnapshot(
        {
          width: WORLD_CONFIG.mapWidth,
          height: WORLD_CONFIG.mapHeight,
          revision: 1,
          definitionCodes: roadPlan.proposedDefinitionCodes,
        },
        WORLD_CONFIG,
      );
      const zoneEnvironment = createZonePlacementEnvironment(
        TERRAIN,
        WATER,
        roads,
        EMPTY_OCCUPANCY,
        WORLD_CONFIG,
      );

      for (const direction of DIRECTIONS) {
        const depth = [1, 2, 3, 4].map((distance) => add(road, direction, distance)) as [
          CellCoord,
          CellCoord,
          CellCoord,
          CellCoord,
        ];
        const depthPlans = depth.map((cell) =>
          planZoneMutation(
            emptyZones,
            { operation: 'paint', definitionId: 'residential', cells: [cell] },
            zoneEnvironment,
            WORLD_CONFIG,
          ),
        );
        if (!depthPlans.slice(0, 3).every((plan) => plan.valid)) continue;
        if (depthPlans[3]?.invalidReason !== 'zone:road-access-required') continue;

        const alternatives = DIRECTIONS.map((candidate) => add(road, candidate, 1)).filter(
          (cell) => !depth.some((depthCell) => depthCell.x === cell.x && depthCell.z === cell.z),
        );
        const validAlternatives = alternatives.filter(
          (cell) =>
            planZoneMutation(
              emptyZones,
              { operation: 'paint', definitionId: 'commercial', cells: [cell] },
              zoneEnvironment,
              WORLD_CONFIG,
            ).valid,
        );
        if (validAlternatives.length < 2) continue;
        return Object.freeze({
          road,
          depth: Object.freeze(depth) as ZoningFixture['depth'],
          commercial: validAlternatives[0]!,
          industrial: validAlternatives[1]!,
        });
      }
    }
  }
  throw new Error('zoning:no-deterministic-fixture');
}

const FIXTURE = fixture();

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
}

async function locate(
  page: Page,
  cells: readonly CellCoord[],
): Promise<Map<string, TerrainCellScreenPoint>> {
  const points = new Map<string, TerrainCellScreenPoint>();
  for (const cell of cells) {
    points.set(`${cell.x}:${cell.z}`, await clickTerrainCell(page, cell));
  }
  return points;
}

function at(points: Map<string, TerrainCellScreenPoint>, cell: CellCoord): TerrainCellScreenPoint {
  const point = points.get(`${cell.x}:${cell.z}`);
  if (point === undefined) throw new Error(`zoning:missing-point:${cell.x}:${cell.z}`);
  return point;
}

async function buildFixtureRoad(
  page: Page,
  points: Map<string, TerrainCellScreenPoint>,
): Promise<void> {
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  const point = at(points, FIXTURE.road);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road built');
}

async function paint(
  page: Page,
  points: Map<string, TerrainCellScreenPoint>,
  type: 'Residential' | 'Commercial' | 'Industrial',
  cell: CellCoord,
): Promise<void> {
  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: type, exact: true }).click();
  const point = at(points, cell);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Zone painted');
}

test('paints R/C/I at committed-Road depths 1–3 and round-trips WorldSaveV5', async ({ page }) => {
  test.setTimeout(60_000);
  await openGame(page);
  const points = await locate(page, [
    FIXTURE.road,
    ...FIXTURE.depth,
    FIXTURE.commercial,
    FIXTURE.industrial,
  ]);
  await buildFixtureRoad(page, points);

  for (const cell of FIXTURE.depth.slice(0, 3)) {
    await paint(page, points, 'Residential', cell);
  }
  await paint(page, points, 'Commercial', FIXTURE.commercial);
  await paint(page, points, 'Industrial', FIXTURE.industrial);

  let evidence = await readEvidence(page);
  expect(evidence.zone.counts).toEqual({ residential: 3, commercial: 1, industrial: 1, total: 5 });
  expect(evidence.zone.committedRootCount).toBe(1);
  expect(evidence.zone.previewRootCount).toBe(0);
  await expect(await readZoningCounts(page)).toEqual({
    residential: '3',
    commercial: '1',
    industrial: '1',
  });

  await clickGameMenuAction(page, 'Save world');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    kind: 'world-save',
    schemaVersion: 6,
    zones: { schemaVersion: 1 },
    buildings: { schemaVersion: 2, instances: [] },
    rci: { schemaVersion: 1 },
  });

  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: 'Remove Zone' }).click();
  const industrialPoint = at(points, FIXTURE.industrial);
  await page.mouse.click(industrialPoint.x, industrialPoint.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Zone removed');
  expect((await readEvidence(page)).zone.counts.industrial).toBe(0);

  await clickToolUndo(page);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Zone undone');
  evidence = await readEvidence(page);
  expect(evidence.zone.counts.industrial).toBe(1);
  expect(evidence.zone.undoCount).toBe(1);

  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('tool-context-status')).toHaveText('Loaded');
  evidence = await readEvidence(page);
  expect(evidence.zone.counts.total).toBe(5);
  expect(evidence.sceneRootCounts.zoneCommitted).toBe(1);
  expect(evidence.sceneRootCounts.zonePreview).toBe(0);
});

test('rejects depth four and preserves Zone invariants across Road and Terraform tools', async ({
  page,
}) => {
  await openGame(page);
  const points = await locate(page, [FIXTURE.road, FIXTURE.depth[2], FIXTURE.depth[3]]);
  await buildFixtureRoad(page, points);
  await paint(page, points, 'Residential', FIXTURE.depth[2]);
  const committed = await readEvidence(page);

  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: 'Residential', exact: true }).click();
  const depthFour = at(points, FIXTURE.depth[3]);
  await dispatchCanvasTouch(page, 'pointerdown', 1, depthFour.x, depthFour.y);
  let evidence = await readEvidence(page);
  expect(evidence.zone.previewValid).toBe(false);
  expect(evidence.zone.previewInvalidReason).toBe('zone:road-access-required');
  expect(evidence.zone.previewRootCount).toBe(1);
  await dispatchCanvasTouch(page, 'pointercancel', 1, depthFour.x, depthFour.y);
  evidence = await readEvidence(page);
  expect(evidence.zone.previewRootCount).toBe(0);
  expect(evidence.zone.committedZoneRevision).toBe(committed.zone.committedZoneRevision);

  const zonePoint = at(points, FIXTURE.depth[2]);
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(zonePoint.x, zonePoint.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road blocked by zone');
  expect((await readEvidence(page)).road.committedRoadRevision).toBe(
    committed.road.committedRoadRevision,
  );

  const roadPoint = at(points, FIXTURE.road);
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  await page.mouse.click(roadPoint.x, roadPoint.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Road required by zone');
  expect((await readEvidence(page)).road.occupiedCellCount).toBe(1);

  await openBuildCategory(page, 'terrain');
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.click(zonePoint.x, zonePoint.y);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Terraform blocked by zone');
  evidence = await readEvidence(page);
  expect(evidence.terraform.committedTerrainRevision).toBe(
    committed.terraform.committedTerrainRevision,
  );
  expect(evidence.zone.counts.residential).toBe(1);
});

test('cancels isolated Zone Preview on second touch and restores one Zone root after context loss', async ({
  page,
}) => {
  await openGame(page);
  const points = await locate(page, [FIXTURE.road, FIXTURE.depth[0]]);
  await buildFixtureRoad(page, points);
  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: 'Residential', exact: true }).click();
  const point = at(points, FIXTURE.depth[0]);
  const before = await readEvidence(page);

  await dispatchCanvasTouch(page, 'pointerdown', 1, point.x, point.y);
  expect((await readEvidence(page)).zone.previewRootCount).toBe(1);
  await dispatchCanvasTouch(page, 'pointerdown', 2, point.x + 80, point.y);
  let evidence = await readEvidence(page);
  expect(evidence.zone.previewRootCount).toBe(0);
  expect(evidence.zone.committedZoneRevision).toBe(before.zone.committedZoneRevision);
  await dispatchCanvasTouch(page, 'pointerup', 1, point.x, point.y);
  await dispatchCanvasTouch(page, 'pointerup', 2, point.x + 80, point.y);

  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
  });
  await waitForCityUi(page);
  evidence = await readEvidence(page);
  expect(evidence.sceneRootCounts.zoneCommitted).toBe(1);
  expect(evidence.sceneRootCounts.zonePreview).toBe(0);
});
