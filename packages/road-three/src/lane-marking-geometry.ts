import {
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  type RoadCellView,
} from '@web-three-city/road-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { createRoadMeshData, emptyRoadMeshData, type RoadMeshData } from './road-mesh-data.js';
import { roadStyleProfileForDefinition } from './road-style-profile.js';

function gridXToWorld(gridX: number, config: WorldConfig): number {
  return (gridX - config.mapWidth / 2) * config.cellSize;
}

function gridZToWorld(gridZ: number, config: WorldConfig): number {
  return (gridZ - config.mapHeight / 2) * config.cellSize;
}

function levelAt(view: RoadCellView, worldX: number, worldZ: number, config: WorldConfig): number {
  const cellMinX = gridXToWorld(view.cell.x, config);
  const cellMinZ = gridZToWorld(view.cell.z, config);
  const u = (worldX - cellMinX) / config.cellSize;
  const v = (worldZ - cellMinZ) / config.cellSize;
  const { nw, ne, sw, se } = view.surface.corners;
  return nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v;
}

function appendVertex(
  positions: number[],
  normals: number[],
  colors: number[],
  view: RoadCellView,
  config: WorldConfig,
  worldX: number,
  worldZ: number,
): void {
  const profile = roadStyleProfileForDefinition(view.definition);
  positions.push(
    worldX,
    levelAt(view, worldX, worldZ, config) * config.heightStep +
      view.definition.surfaceOffset +
      profile.markingSurfaceOffset,
    worldZ,
  );
  normals.push(0, 1, 0);
  colors.push(
    profile.centerDividerColor.r,
    profile.centerDividerColor.g,
    profile.centerDividerColor.b,
  );
}

function buildDividerRectangle(
  view: RoadCellView,
  config: WorldConfig,
  orientation: 'north-south' | 'east-west',
): RoadMeshData {
  const profile = roadStyleProfileForDefinition(view.definition);
  if (!profile.centerDividerVisible) return emptyRoadMeshData();

  const cellMinX = gridXToWorld(view.cell.x, config);
  const cellMinZ = gridZToWorld(view.cell.z, config);
  const cellMaxX = cellMinX + config.cellSize;
  const cellMaxZ = cellMinZ + config.cellSize;
  const centerX = (cellMinX + cellMaxX) / 2;
  const centerZ = (cellMinZ + cellMaxZ) / 2;
  const half = profile.centerDividerWidth / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const corners =
    orientation === 'north-south'
      ? ([
          [centerX - half, cellMinZ],
          [centerX + half, cellMinZ],
          [centerX + half, cellMaxZ],
          [centerX - half, cellMaxZ],
        ] as const)
      : ([
          [cellMinX, centerZ - half],
          [cellMaxX, centerZ - half],
          [cellMaxX, centerZ + half],
          [cellMinX, centerZ + half],
        ] as const);

  for (const [worldX, worldZ] of corners) {
    appendVertex(positions, normals, colors, view, config, worldX, worldZ);
  }

  return createRoadMeshData({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array([0, 3, 2, 0, 2, 1]),
  });
}

export function buildRoadLaneMarkingMesh(
  view: RoadCellView,
  config: WorldConfig,
): RoadMeshData {
  const northSouth = ROAD_NORTH | ROAD_SOUTH;
  const eastWest = ROAD_EAST | ROAD_WEST;
  if (view.connections === northSouth) {
    return buildDividerRectangle(view, config, 'north-south');
  }
  if (view.connections === eastWest) {
    return buildDividerRectangle(view, config, 'east-west');
  }
  return emptyRoadMeshData();
}
