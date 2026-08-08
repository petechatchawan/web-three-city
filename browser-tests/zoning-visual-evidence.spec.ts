import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  planRoadMutation,
} from '../packages/road-core/src/index.js';
import { generateCoastalTerrain } from '../packages/terrain-generator/src/index.js';
import { deriveWaterSnapshot } from '../packages/water-core/src/index.js';
import { createEmptyZoneSnapshot, planZoneMutation } from '../packages/zone-core/src/index.js';
import { WORLD_CONFIG, type CellCoord } from '../packages/world-core/src/index.js';
import { createRoadPlacementEnvironment } from '../apps/game/src/road-placement-environment.js';
import { createZonePlacementEnvironment } from '../apps/game/src/zone-placement-environment.js';
import {
  GAME_URL,
  dispatchCanvasTouch,
  projectTerrainCells,
  readEvidence,
  type TerrainCellScreenPoint,
} from './helpers/interaction.js';

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
const ROAD_ENVIRONMENT = createRoadPlacementEnvironment(TERRAIN, WATER, WORLD_CONFIG);
const EMPTY_OCCUPANCY = Object.freeze({ revision: 0, isBlocked: () => false });
const DIRECTIONS = Object.freeze([
  Object.freeze({ x: 0, z: -1 }),
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: -1, z: 0 }),
]);

interface ZoningVisualFixture {
  readonly road: CellCoord;
  readonly residential: readonly [CellCoord, CellCoord, CellCoord];
  readonly invalidDepthFour: CellCoord;
  readonly commercial: CellCoord;
  readonly industrial: CellCoord;
}

function add(cell: CellCoord, direction: CellCoord, distance: number): CellCoord {
  return Object.freeze({
    x: cell.x + direction.x * distance,
    z: cell.z + direction.z * distance,
  });
}

function findFixture(): ZoningVisualFixture {
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
      const environment = createZonePlacementEnvironment(
        TERRAIN,
        WATER,
        roads,
        EMPTY_OCCUPANCY,
        WORLD_CONFIG,
      );

      for (const direction of DIRECTIONS) {
        const depth = [1, 2, 3, 4].map((distance) => add(road, direction, distance));
        const plans = depth.map((cell) =>
          planZoneMutation(
            emptyZones,
            { operation: 'paint', definitionId: 'residential', cells: [cell] },
            environment,
            WORLD_CONFIG,
          ),
        );
        if (!plans.slice(0, 3).every((plan) => plan.valid)) continue;
        if (plans[3]?.invalidReason !== 'zone:road-access-required') continue;

        const alternatives = DIRECTIONS.map((candidate) => add(road, candidate, 1)).filter(
          (cell) => !depth.some((depthCell) => depthCell.x === cell.x && depthCell.z === cell.z),
        );
        const validAlternatives = alternatives.filter(
          (cell) =>
            planZoneMutation(
              emptyZones,
              { operation: 'paint', definitionId: 'commercial', cells: [cell] },
              environment,
              WORLD_CONFIG,
            ).valid,
        );
        if (validAlternatives.length < 2) continue;

        return Object.freeze({
          road,
          residential: Object.freeze(depth.slice(0, 3)) as ZoningVisualFixture['residential'],
          invalidDepthFour: depth[3]!,
          commercial: validAlternatives[0]!,
          industrial: validAlternatives[1]!,
        });
      }
    }
  }

  throw new Error('zoning-visual:no-deterministic-fixture');
}

const FIXTURE = findFixture();

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

async function locate(
  page: Page,
  cells: readonly CellCoord[],
): Promise<Map<string, TerrainCellScreenPoint>> {
  const projected = await projectTerrainCells(page, cells);
  return new Map(cells.map((cell, index) => [key(cell), projected[index]!] as const));
}

function pointAt(
  points: Map<string, TerrainCellScreenPoint>,
  cell: CellCoord,
): TerrainCellScreenPoint {
  const point = points.get(key(cell));
  if (point === undefined) throw new Error(`zoning-visual:missing-point:${key(cell)}`);
  return point;
}

async function clickCell(
  page: Page,
  points: Map<string, TerrainCellScreenPoint>,
  cell: CellCoord,
): Promise<void> {
  const point = pointAt(points, cell);
  await page.mouse.click(point.x, point.y);
}

async function paint(
  page: Page,
  points: Map<string, TerrainCellScreenPoint>,
  type: 'Residential' | 'Commercial' | 'Industrial',
  cell: CellCoord,
): Promise<void> {
  await page.getByRole('button', { name: type, exact: true }).click();
  await clickCell(page, points, cell);
  await expect(page.getByTestId('game-status')).toHaveText('Zone painted');
}

async function capture(page: Page, testInfo: TestInfo, fileName: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(fileName), fullPage: true });
}

test('captures committed R/C/I overlays, invalid depth feedback, and responsive Zone HUD', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');

  const cells = [
    FIXTURE.road,
    ...FIXTURE.residential,
    FIXTURE.invalidDepthFour,
    FIXTURE.commercial,
    FIXTURE.industrial,
  ];
  const points = await locate(page, cells);

  await page.getByRole('button', { name: 'Build Road' }).click();
  await clickCell(page, points, FIXTURE.road);
  await expect(page.getByTestId('game-status')).toHaveText('Road built');

  for (const cell of FIXTURE.residential) await paint(page, points, 'Residential', cell);
  await paint(page, points, 'Commercial', FIXTURE.commercial);
  await paint(page, points, 'Industrial', FIXTURE.industrial);

  let evidence = await readEvidence(page);
  expect(evidence.zone.counts).toEqual({ residential: 3, commercial: 1, industrial: 1, total: 5 });
  expect(evidence.zone.committedRootCount).toBe(1);
  expect(evidence.zone.previewRootCount).toBe(0);
  await capture(page, testInfo, 'zoning-committed-desktop.png');

  await page.getByRole('button', { name: 'Residential', exact: true }).click();
  const invalid = pointAt(points, FIXTURE.invalidDepthFour);
  await dispatchCanvasTouch(page, 'pointerdown', 71, invalid.x, invalid.y);
  evidence = await readEvidence(page);
  expect(evidence.zone.previewValid).toBe(false);
  expect(evidence.zone.previewInvalidReason).toBe('zone:road-access-required');
  expect(evidence.zone.previewRootCount).toBe(1);
  await capture(page, testInfo, 'zoning-invalid-depth-four.png');
  await dispatchCanvasTouch(page, 'pointercancel', 71, invalid.x, invalid.y);
  expect((await readEvidence(page)).zone.previewRootCount).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Residential', exact: true })).toBeVisible();
  await expect(page.getByTestId('zone-residential-count')).toHaveText('3');
  await expect(page.getByTestId('zone-commercial-count')).toHaveText('1');
  await expect(page.getByTestId('zone-industrial-count')).toHaveText('1');
  await capture(page, testInfo, 'zoning-committed-mobile.png');
});
