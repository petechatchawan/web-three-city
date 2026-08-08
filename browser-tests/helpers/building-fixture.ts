import { expect, type Page } from '@playwright/test';
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
import { clickTerrainCell, type TerrainCellScreenPoint } from './interaction.js';

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
