from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f'acceptance:missing-pattern:{path}:{old[:120]}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


replace_once(
    'apps/game/src/game-bootstrap.ts',
    "        occupiedCellCount: occupiedBuildingCellCount(buildingsSnapshot),\n        commitCount: buildingCommitCount,\n",
    "        occupiedCellCount: occupiedBuildingCellCount(buildingsSnapshot),\n        definitionIds: Object.freeze(\n          buildingsSnapshot.instances\n            .map((instance) => instance.buildingDefinitionId)\n            .sort((first, second) => first.localeCompare(second)),\n        ),\n        commitCount: buildingCommitCount,\n",
)

replace_once(
    'browser-tests/zoning.spec.ts',
    "const SAVE_KEY = 'web-three-city:world-save:v2';",
    "const SAVE_KEY = 'web-three-city:world-save:v3';",
)
replace_once(
    'browser-tests/zoning.spec.ts',
    "test('paints R/C/I at committed-Road depths 1–3 and round-trips WorldSaveV2', async ({ page }) => {",
    "test('paints R/C/I at committed-Road depths 1–3 and round-trips WorldSaveV3', async ({ page }) => {",
)
replace_once(
    'browser-tests/zoning.spec.ts',
    "    schemaVersion: 2,\n    zones: { schemaVersion: 1 },\n",
    "    schemaVersion: 3,\n    zones: { schemaVersion: 1 },\n    buildings: { schemaVersion: 1, instances: [] },\n",
)

write(
    'browser-tests/helpers/building-fixture.ts',
    '''import { expect, type Page } from '@playwright/test';
import {
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  planRoadMutation,
} from '../../packages/road-core/src/index.js';
import { generateCoastalTerrain } from '../../packages/terrain-generator/src/index.js';
import { deriveWaterSnapshot } from '../../packages/water-core/src/index.js';
import {
  createEmptyZoneSnapshot,
  planZoneMutation,
  type ZoneDefinitionId,
} from '../../packages/zone-core/src/index.js';
import { WORLD_CONFIG, type CellCoord } from '../../packages/world-core/src/index.js';
import { createRoadPlacementEnvironment } from '../../apps/game/src/road-placement-environment.js';
import { createZonePlacementEnvironment } from '../../apps/game/src/zone-placement-environment.js';
import {
  clickTerrainCell,
  type TerrainCellScreenPoint,
} from './interaction.js';

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

export interface BuildingLotFixture {
  readonly zoneDefinitionId: ZoneDefinitionId;
  readonly zoneButtonName: 'Residential' | 'Commercial' | 'Industrial';
  readonly roadCells: readonly [CellCoord, CellCoord];
  readonly zoneCells: readonly [CellCoord, CellCoord, CellCoord, CellCoord];
}

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function reserve(cells: readonly CellCoord[], reserved: Set<string>): void {
  for (const cell of cells) {
    for (let dz = -4; dz <= 4; dz += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        reserved.add(`${cell.x + dx}:${cell.z + dz}`);
      }
    }
  }
}

function findFixture(
  zoneDefinitionId: ZoneDefinitionId,
  zoneButtonName: BuildingLotFixture['zoneButtonName'],
  reserved: Set<string>,
): BuildingLotFixture {
  const emptyRoads = createEmptyRoadSnapshot(WORLD_CONFIG);
  const emptyZones = createEmptyZoneSnapshot(WORLD_CONFIG);

  for (let z = 8; z < WORLD_CONFIG.mapHeight - 4; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 4; x += 1) {
      const roadCells = Object.freeze([
        Object.freeze({ x, z }),
        Object.freeze({ x: x + 1, z }),
      ]) as BuildingLotFixture['roadCells'];
      const zoneCells = Object.freeze([
        Object.freeze({ x, z: z + 1 }),
        Object.freeze({ x: x + 1, z: z + 1 }),
        Object.freeze({ x, z: z + 2 }),
        Object.freeze({ x: x + 1, z: z + 2 }),
      ]) as BuildingLotFixture['zoneCells'];
      const allCells = [...roadCells, ...zoneCells];
      if (allCells.some((cell) => reserved.has(key(cell)))) continue;

      const roadPlan = planRoadMutation(
        emptyRoads,
        { operation: 'build', definitionId: 'basic-road', cells: roadCells },
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
      const completeZonePlan = planZoneMutation(
        emptyZones,
        { operation: 'paint', definitionId: zoneDefinitionId, cells: zoneCells },
        zoneEnvironment,
        WORLD_CONFIG,
      );
      if (!completeZonePlan.valid) continue;
      if (
        !zoneCells.every(
          (cell) =>
            planZoneMutation(
              emptyZones,
              { operation: 'paint', definitionId: zoneDefinitionId, cells: [cell] },
              zoneEnvironment,
              WORLD_CONFIG,
            ).valid,
        )
      ) {
        continue;
      }

      reserve(allCells, reserved);
      return Object.freeze({ zoneDefinitionId, zoneButtonName, roadCells, zoneCells });
    }
  }
  throw new Error(`building:no-deterministic-${zoneDefinitionId}-fixture`);
}

const RESERVED = new Set<string>();
export const BUILDING_FIXTURES = Object.freeze({
  residential: findFixture('residential', 'Residential', RESERVED),
  commercial: findFixture('commercial', 'Commercial', RESERVED),
  industrial: findFixture('industrial', 'Industrial', RESERVED),
});

export const ALL_BUILDING_FIXTURE_CELLS: readonly CellCoord[] = Object.freeze(
  Object.values(BUILDING_FIXTURES).flatMap((fixture) => [
    ...fixture.roadCells,
    ...fixture.zoneCells,
  ]),
);

export type BuildingFixturePoints = ReadonlyMap<string, TerrainCellScreenPoint>;

export function pointFor(
  points: BuildingFixturePoints,
  cell: CellCoord,
): TerrainCellScreenPoint {
  const point = points.get(key(cell));
  if (point === undefined) throw new Error(`building:missing-point:${key(cell)}`);
  return point;
}

export async function locateBuildingFixturePoints(page: Page): Promise<BuildingFixturePoints> {
  const points = new Map<string, TerrainCellScreenPoint>();
  for (const cell of ALL_BUILDING_FIXTURE_CELLS) {
    points.set(key(cell), await clickTerrainCell(page, cell));
  }
  return points;
}

async function buildRoad(
  page: Page,
  points: BuildingFixturePoints,
  fixture: BuildingLotFixture,
): Promise<void> {
  await page.getByRole('button', { name: 'Build Road' }).click();
  const start = pointFor(points, fixture.roadCells[0]);
  const end = pointFor(points, fixture.roadCells[1]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  await expect(page.getByTestId('game-status')).toHaveText('Road built');
}

async function paintZone(
  page: Page,
  points: BuildingFixturePoints,
  fixture: BuildingLotFixture,
): Promise<void> {
  await page.getByRole('button', { name: fixture.zoneButtonName, exact: true }).click();
  for (const cell of fixture.zoneCells) {
    const point = pointFor(points, cell);
    await page.mouse.click(point.x, point.y);
    await expect(page.getByTestId('game-status')).toHaveText('Zone painted');
  }
}

export async function prepareBuildingFixtureWorld(
  page: Page,
): Promise<BuildingFixturePoints> {
  const points = await locateBuildingFixturePoints(page);
  for (const fixture of Object.values(BUILDING_FIXTURES)) await buildRoad(page, points, fixture);
  for (const fixture of Object.values(BUILDING_FIXTURES)) await paintZone(page, points, fixture);
  return points;
}
''',
)

write(
    'browser-tests/building.spec.ts',
    '''import { expect, test, type Page } from '@playwright/test';
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
  'industrial-warehouse-2x2',
  'residential-rowhouse-1x2',
  'residential-rowhouse-1x2',
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
  expect(evidence.building.count).toBe(4);
  expect(evidence.building.occupiedCellCount).toBe(12);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.commitCount).toBe(1);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
  await expect(page.getByTestId('building-count')).toHaveText('4');

  const commercialCell = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[0]);

  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(commercialCell.x, commercialCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road blocked by building');

  await page.getByRole('button', { name: 'Remove Zone' }).click();
  await page.mouse.click(commercialCell.x, commercialCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zone blocked by building');

  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.click(commercialCell.x, commercialCell.y);
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
  expect(evidence.building.count).toBe(4);
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
        expect.objectContaining({ buildingDefinitionId: 'industrial-warehouse-2x2' }),
        expect.objectContaining({ buildingDefinitionId: 'residential-rowhouse-1x2' }),
      ]),
    },
  });

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialCell.x, commercialCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.occupiedCellCount).toBe(8);
  expect(evidence.building.definitionIds).not.toContain('commercial-office-2x2');
  expect(evidence.zone.counts.commercial).toBe(4);

  await page.getByRole('button', { name: 'Undo latest world change' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Building undone');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(4);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.undoCount).toBe(1);

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialCell.x, commercialCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(4);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});
''',
)

write(
    'browser-tests/building-visual-evidence.spec.ts',
    '''import { expect, test } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test('captures deterministic Residential, Commercial, and Industrial prototypes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  const points = await prepareBuildingFixtureWorld(page);

  await page.getByRole('button', { name: 'Develop Zones' }).click();
  const trigger = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[0]);
  await page.mouse.click(trigger.x, trigger.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zones developed');

  const evidence = await readEvidence(page);
  expect(evidence.building.definitionIds).toEqual([
    'commercial-office-2x2',
    'industrial-warehouse-2x2',
    'residential-rowhouse-1x2',
    'residential-rowhouse-1x2',
  ]);
  await page.screenshot({
    path: testInfo.outputPath('building-foundation-rci-prototypes.png'),
    fullPage: true,
  });
});
''',
)

replace_once(
    'docs/superpowers/evidence/2026-08-03-building-content-occupancy-foundation-v0-1.md',
    'Implementation and automated/manual test specifications are written on the feature branch. Verification is intentionally deferred until the Owner\'s final test pass.',
    'Implementation, deterministic browser acceptance, visual evidence capture, and automated/manual test specifications are written on the feature branch. Verification is intentionally deferred until the Owner\'s final test pass.',
)

print('Finalized Building acceptance coverage without running verification')
