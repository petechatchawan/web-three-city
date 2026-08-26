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

export type RoadCornerKind = 'north-east' | 'east-south' | 'south-west' | 'west-north';

interface PointXZ {
  readonly x: number;
  readonly z: number;
}

const CORNER_STEPS = 8;

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

function quadraticPoint(p0: PointXZ, p1: PointXZ, p2: PointXZ, t: number): PointXZ {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * p0.x + 2 * inverse * t * p1.x + t * t * p2.x,
    z: inverse * inverse * p0.z + 2 * inverse * t * p1.z + t * t * p2.z,
  };
}

function quadraticTangent(p0: PointXZ, p1: PointXZ, p2: PointXZ, t: number): PointXZ {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    z: 2 * (1 - t) * (p1.z - p0.z) + 2 * t * (p2.z - p1.z),
  };
}

function cornerControlPoints(
  view: RoadCellView,
  config: WorldConfig,
  corner: RoadCornerKind,
): readonly [PointXZ, PointXZ, PointXZ] {
  const cellMinX = gridXToWorld(view.cell.x, config);
  const cellMinZ = gridZToWorld(view.cell.z, config);
  const cellMaxX = cellMinX + config.cellSize;
  const cellMaxZ = cellMinZ + config.cellSize;
  const centerX = (cellMinX + cellMaxX) / 2;
  const centerZ = (cellMinZ + cellMaxZ) / 2;
  const center = Object.freeze({ x: centerX, z: centerZ });

  switch (corner) {
    case 'north-east':
      return Object.freeze([
        Object.freeze({ x: centerX, z: cellMinZ }),
        center,
        Object.freeze({ x: cellMaxX, z: centerZ }),
      ]);
    case 'east-south':
      return Object.freeze([
        Object.freeze({ x: cellMaxX, z: centerZ }),
        center,
        Object.freeze({ x: centerX, z: cellMaxZ }),
      ]);
    case 'south-west':
      return Object.freeze([
        Object.freeze({ x: centerX, z: cellMaxZ }),
        center,
        Object.freeze({ x: cellMinX, z: centerZ }),
      ]);
    case 'west-north':
      return Object.freeze([
        Object.freeze({ x: cellMinX, z: centerZ }),
        center,
        Object.freeze({ x: centerX, z: cellMinZ }),
      ]);
  }
}

export function classifyRoadCorner(connections: number): RoadCornerKind | null {
  switch (connections) {
    case ROAD_NORTH | ROAD_EAST:
      return 'north-east';
    case ROAD_EAST | ROAD_SOUTH:
      return 'east-south';
    case ROAD_SOUTH | ROAD_WEST:
      return 'south-west';
    case ROAD_WEST | ROAD_NORTH:
      return 'west-north';
    default:
      return null;
  }
}

export function buildRoadCornerLaneMarkingMesh(
  view: RoadCellView,
  config: WorldConfig,
  corner: RoadCornerKind,
): RoadMeshData {
  const profile = roadStyleProfileForDefinition(view.definition);
  if (!profile.centerDividerVisible) return emptyRoadMeshData();

  const [p0, p1, p2] = cornerControlPoints(view, config, corner);
  const halfWidth = profile.centerDividerWidth / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let step = 0; step <= CORNER_STEPS; step += 1) {
    const t = step / CORNER_STEPS;
    const center = quadraticPoint(p0, p1, p2, t);
    const tangent = quadraticTangent(p0, p1, p2, t);
    const magnitude = Math.hypot(tangent.x, tangent.z);
    if (!(magnitude > 0)) throw new Error('road-three:invalid-corner-marking-tangent');
    const perpendicularX = -tangent.z / magnitude;
    const perpendicularZ = tangent.x / magnitude;

    for (const side of [-1, 1] as const) {
      const worldX = center.x + perpendicularX * halfWidth * side;
      const worldZ = center.z + perpendicularZ * halfWidth * side;
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

    if (step === CORNER_STEPS) continue;
    const row = step * 2;
    indices.push(row, row + 3, row + 2, row, row + 1, row + 3);
  }

  return createRoadMeshData({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  });
}
