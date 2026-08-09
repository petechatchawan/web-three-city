import { expect, type Page } from '@playwright/test';
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
  type ZoneDefinitionId,
} from './domain-fixtures.js';
import { clickTerrainCell, locateTerrainCell, type TerrainCellScreenPoint } from './interaction.js';

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
  centered = false,
): BuildingLotFixture {
  const emptyRoads = createEmptyRoadSnapshot(WORLD_CONFIG);
  const emptyZones = createEmptyZoneSnapshot(WORLD_CONFIG);
  const origins: CellCoord[] = [];
  for (let z = 8; z < WORLD_CONFIG.mapHeight - 4; z += 1) {
    for (let x = 8; x < WORLD_CONFIG.mapWidth - 4; x += 1) origins.push({ x, z });
  }
  if (centered) {
    const centerX = WORLD_CONFIG.mapWidth / 2;
    const centerZ = WORLD_CONFIG.mapHeight / 2;
    origins.sort(
      (first, second) =>
        (first.x - centerX) ** 2 +
        (first.z - centerZ) ** 2 -
        ((second.x - centerX) ** 2 + (second.z - centerZ) ** 2),
    );
  }

  for (const { x, z } of origins) {
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
      ROAD_PLACEMENT_ENVIRONMENT,
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
      GAME_TERRAIN,
      GAME_WATER,
      roads,
      EMPTY_WORLD_OCCUPANCY,
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
  throw new Error(`building:no-deterministic-${zoneDefinitionId}-fixture`);
}

const RESERVED = new Set<string>();
export const BUILDING_FIXTURES = Object.freeze({
  residential: findFixture('residential', 'Residential', RESERVED),
  commercial: findFixture('commercial', 'Commercial', RESERVED),
  industrial: findFixture('industrial', 'Industrial', RESERVED),
});

export const CENTER_BUILDING_FIXTURE = findFixture(
  'residential',
  'Residential',
  new Set<string>(),
  true,
);

export const ALL_BUILDING_FIXTURE_CELLS: readonly CellCoord[] = Object.freeze(
  Object.values(BUILDING_FIXTURES).flatMap((fixture) => [
    ...fixture.roadCells,
    ...fixture.zoneCells,
  ]),
);

export type BuildingFixturePoints = ReadonlyMap<string, TerrainCellScreenPoint>;

export function pointFor(points: BuildingFixturePoints, cell: CellCoord): TerrainCellScreenPoint {
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

export async function prepareBuildingFixtureWorld(page: Page): Promise<BuildingFixturePoints> {
  const points = await locateBuildingFixturePoints(page);
  for (const fixture of Object.values(BUILDING_FIXTURES)) await buildRoad(page, points, fixture);
  for (const fixture of Object.values(BUILDING_FIXTURES)) await paintZone(page, points, fixture);
  return points;
}

export async function prepareSingleBuildingFixtureWorld(
  page: Page,
  fixture: BuildingLotFixture,
): Promise<BuildingFixturePoints> {
  const points = new Map<string, TerrainCellScreenPoint>();
  for (const cell of [...fixture.roadCells, ...fixture.zoneCells]) {
    points.set(key(cell), await locateTerrainCell(page, cell));
  }
  await buildRoad(page, points, fixture);
  await paintZone(page, points, fixture);
  return points;
}
