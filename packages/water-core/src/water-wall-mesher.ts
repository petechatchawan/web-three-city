import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { WaterContractError } from './errors.js';
import type { WaterWallMeshData } from './mesh-data.js';
import { WATER_GEOMETRY_EPSILON } from './policy.js';
import { wetIntervalForEdge } from './wet-fragment.js';
import { triangleIndexFor, type WaterSnapshot } from './water-snapshot.js';

const WATER_SURFACE_OFFSET = 0.01;
const WATER_WALL_OUTWARD_OFFSET = 0.01;
const TOP_COLOR = [0.4, 0.72, 0.9] as const;
const BASE_COLOR = [0.18, 0.42, 0.62] as const;

interface Interval {
  readonly start: number;
  readonly end: number;
}

function assertCompatible(terrain: TerrainSnapshot, water: WaterSnapshot): void {
  if (
    terrain.revision !== water.sourceTerrainRevision ||
    terrain.width !== water.width ||
    terrain.height !== water.height
  ) {
    throw new WaterContractError({ code: 'water:terrain-revision-mismatch' });
  }
}

function boundaryLevel(terrain: TerrainSnapshot, x: number): number {
  return terrain.heightLevels[terrain.height * (terrain.width + 1) + x]!;
}

function collectIntervals(terrain: TerrainSnapshot, water: WaterSnapshot): Interval[] {
  const intervals: Interval[] = [];
  const cellZ = terrain.height - 1;
  for (let cellX = 0; cellX < terrain.width; cellX += 1) {
    const triangleIndex = triangleIndexFor(cellX, cellZ, 0, terrain.width);
    if (water.seaTriangleMask[triangleIndex] !== 1) continue;
    const interval = wetIntervalForEdge(
      boundaryLevel(terrain, cellX),
      boundaryLevel(terrain, cellX + 1),
      water.seaLevel,
    );
    if (interval === null || interval.end - interval.start <= WATER_GEOMETRY_EPSILON) {
      continue;
    }
    intervals.push({ start: cellX + interval.start, end: cellX + interval.end });
  }

  intervals.sort((first, second) => first.start - second.start || first.end - second.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous !== undefined && interval.start <= previous.end + WATER_GEOMETRY_EPSILON) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function buildWaterWallMesh(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  config: WorldConfig,
): WaterWallMeshData {
  assertCompatible(terrain, water);
  const intervals = collectIntervals(terrain, water);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const topY = config.seaLevel * config.heightStep + WATER_SURFACE_OFFSET;
  const bottomY = config.dioramaBaseY;
  const z = (terrain.height / 2) * config.cellSize + WATER_WALL_OUTWARD_OFFSET;

  for (const interval of intervals) {
    const base = positions.length / 3;
    const left = (interval.start - terrain.width / 2) * config.cellSize;
    const right = (interval.end - terrain.width / 2) * config.cellSize;
    positions.push(left, topY, z, right, topY, z, right, bottomY, z, left, bottomY, z);
    for (let vertex = 0; vertex < 4; vertex += 1) normals.push(0, 0, 1);
    colors.push(...TOP_COLOR, ...TOP_COLOR, ...BASE_COLOR, ...BASE_COLOR);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  const minX =
    intervals.length === 0 ? 0 : (intervals[0]!.start - terrain.width / 2) * config.cellSize;
  const maxX =
    intervals.length === 0 ? 0 : (intervals.at(-1)!.end - terrain.width / 2) * config.cellSize;

  return Object.freeze({
    sourceTerrainRevision: terrain.revision,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
    segmentCount: intervals.length,
    bounds: {
      min: { x: minX, y: bottomY, z },
      max: { x: maxX, y: topY, z },
    },
  });
}
