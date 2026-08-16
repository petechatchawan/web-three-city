import {
  resolveBuildingFrontage,
  type BuildingDevelopmentEnvironment,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  BASIC_ROAD_CODE,
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import { terrainCellSurfaceProfile, type TerrainSnapshot } from '@web-three-city/terrain-core';
import type {
  BuildingTrafficAccessProjection,
  RoadTrafficSourceCell,
  RoadTrafficSourceProjection,
  TrafficCardinalDirection,
  TrafficGraphDirtyRegion,
} from '@web-three-city/traffic-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';

const CELL_SIZE_Q = 8_000;
const LEVEL_TO_Q = 1_000;

type SurfaceReader = (cell: Readonly<{ x: number; z: number }>) => Readonly<{
  minimumLevel: number;
  maximumLevel: number;
}>;

function roadCodeAt(roads: RoadSnapshot, x: number, z: number): number {
  if (x < 0 || z < 0 || x >= roads.width || z >= roads.height) return 0;
  return roads.definitionCodes[z * roads.width + x] ?? 0;
}

function connectionMaskAt(roads: RoadSnapshot, x: number, z: number): number {
  if (roadCodeAt(roads, x, z) !== BASIC_ROAD_CODE) return 0;
  let mask = 0;
  if (roadCodeAt(roads, x, z - 1) === BASIC_ROAD_CODE) mask |= ROAD_NORTH;
  if (roadCodeAt(roads, x + 1, z) === BASIC_ROAD_CODE) mask |= ROAD_EAST;
  if (roadCodeAt(roads, x, z + 1) === BASIC_ROAD_CODE) mask |= ROAD_SOUTH;
  if (roadCodeAt(roads, x - 1, z) === BASIC_ROAD_CODE) mask |= ROAD_WEST;
  return mask;
}

function createRoadProjection(
  roads: RoadSnapshot,
  surfaceAt: SurfaceReader,
): RoadTrafficSourceProjection {
  const cells: RoadTrafficSourceCell[] = [];
  for (let z = 0; z < roads.height; z += 1) {
    for (let x = 0; x < roads.width; x += 1) {
      const definitionCode = roadCodeAt(roads, x, z);
      if (definitionCode === 0) continue;
      const surface = surfaceAt({ x, z });
      cells.push(
        Object.freeze({
          x,
          z,
          definitionCode,
          connectionMask: connectionMaskAt(roads, x, z),
          elevationStartQ: surface.minimumLevel * LEVEL_TO_Q,
          elevationEndQ: surface.maximumLevel * LEVEL_TO_Q,
        }),
      );
    }
  }
  return Object.freeze({
    roadRevision: roads.revision,
    width: roads.width,
    height: roads.height,
    cells: Object.freeze(cells),
  });
}

export function createRoadTrafficSourceProjection(
  roads: RoadSnapshot,
  terrain: TerrainSnapshot,
): RoadTrafficSourceProjection {
  return createRoadProjection(roads, (cell) =>
    terrainCellSurfaceProfile(terrain, cell, WORLD_CONFIG),
  );
}

export function createRoadTrafficSourceProjectionFromEnvironment(
  roads: RoadSnapshot,
  environment: Pick<BuildingDevelopmentEnvironment, 'surfaceAt'>,
): RoadTrafficSourceProjection {
  return createRoadProjection(roads, (cell) => environment.surfaceAt(cell));
}

export function createTrafficGraphDirtyRegion(
  changedRoadCells: readonly CellCoord[],
  changedBuildingIds: readonly string[] = [],
): TrafficGraphDirtyRegion {
  const roadByKey = new Map<string, CellCoord>();
  for (const cell of changedRoadCells) {
    roadByKey.set(`${cell.x},${cell.z}`, Object.freeze({ x: cell.x, z: cell.z }));
  }
  return Object.freeze({
    changedRoadCells: Object.freeze([...roadByKey.values()].sort((a, b) => a.z - b.z || a.x - b.x)),
    changedBuildingIds: Object.freeze([...new Set(changedBuildingIds)].sort()),
  });
}

function trafficDirection(
  direction: 'north' | 'east' | 'south' | 'west',
): TrafficCardinalDirection {
  return direction === 'north'
    ? 'N'
    : direction === 'east'
      ? 'E'
      : direction === 'south'
        ? 'S'
        : 'W';
}

function entrancePoint(
  cell: Readonly<{ x: number; z: number }>,
  direction: 'north' | 'east' | 'south' | 'west',
  environment: BuildingDevelopmentEnvironment,
): Readonly<{ xQ: number; yQ: number; zQ: number }> {
  const surface = environment.surfaceAt(cell);
  const yQ = Math.round(((surface.minimumLevel + surface.maximumLevel) / 2) * LEVEL_TO_Q);
  const centerXQ = cell.x * CELL_SIZE_Q + CELL_SIZE_Q / 2;
  const centerZQ = cell.z * CELL_SIZE_Q + CELL_SIZE_Q / 2;
  if (direction === 'north') return Object.freeze({ xQ: centerXQ, yQ, zQ: cell.z * CELL_SIZE_Q });
  if (direction === 'east')
    return Object.freeze({ xQ: (cell.x + 1) * CELL_SIZE_Q, yQ, zQ: centerZQ });
  if (direction === 'south')
    return Object.freeze({ xQ: centerXQ, yQ, zQ: (cell.z + 1) * CELL_SIZE_Q });
  return Object.freeze({ xQ: cell.x * CELL_SIZE_Q, yQ, zQ: centerZQ });
}

export function createBuildingTrafficAccessProjection(
  buildings: BuildingSnapshot,
  _roads: RoadSnapshot,
  environment: BuildingDevelopmentEnvironment,
): BuildingTrafficAccessProjection {
  const accesses = buildings.instances
    .filter((instance) => instance.lifecycle === undefined || instance.lifecycle === 'active')
    .map((instance) => {
      const frontage = resolveBuildingFrontage(instance, environment);
      if (frontage === null) return null;
      const entrance = entrancePoint(frontage.frontageCell, frontage.direction, environment);
      return Object.freeze({
        buildingInstanceId: instance.instanceId,
        frontageRoadX: frontage.roadCell.x,
        frontageRoadZ: frontage.roadCell.z,
        frontageDirection: trafficDirection(frontage.direction),
        entranceXQ: entrance.xQ,
        entranceYQ: entrance.yQ,
        entranceZQ: entrance.zQ,
      });
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) =>
      a.buildingInstanceId < b.buildingInstanceId
        ? -1
        : a.buildingInstanceId > b.buildingInstanceId
          ? 1
          : 0,
    );
  return Object.freeze({
    buildingRevision: buildings.revision,
    accesses: Object.freeze(accesses),
  });
}
