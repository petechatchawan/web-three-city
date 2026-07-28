import {
  CELL_TRIANGLES,
  chunkCellBounds,
  selectTerrainDiagonal,
  type ChunkCoord,
  type TerrainCorner,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { WaterContractError } from './errors.js';
import type { WaterChunkMeshData } from './mesh-data.js';
import { WATER_GEOMETRY_EPSILON } from './policy.js';
import {
  clipTriangleToSea,
  wetIntervalForEdge,
  type TriangleVertex,
  type WetVertex,
} from './wet-fragment.js';
import { triangleIndexFor, type WaterSnapshot } from './water-snapshot.js';

const WATER_SURFACE_OFFSET = 0.01;
const SHORELINE_OFFSET = 0.013;
const SHORELINE_WIDTH_CELLS = 0.35;
const SHALLOW_COLOR = [0.36, 0.76, 0.86] as const;
const DEEP_COLOR = [0.06, 0.28, 0.55] as const;
const SHORELINE_COLOR = [0.68, 0.9, 0.92] as const;
const MAX_UINT16_VERTICES = 65_535;

interface LatticePoint {
  readonly x: number;
  readonly z: number;
}

interface ShorelineSegment {
  readonly start: LatticePoint;
  readonly end: LatticePoint;
}

const CORNER_OFFSETS: Readonly<Record<TerrainCorner, LatticePoint>> = Object.freeze({
  nw: Object.freeze({ x: 0, z: 0 }),
  ne: Object.freeze({ x: 1, z: 0 }),
  sw: Object.freeze({ x: 0, z: 1 }),
  se: Object.freeze({ x: 1, z: 1 }),
});

function assertCompatible(terrain: TerrainSnapshot, water: WaterSnapshot): void {
  if (
    terrain.revision !== water.sourceTerrainRevision ||
    terrain.width !== water.width ||
    terrain.height !== water.height
  ) {
    throw new WaterContractError({
      code: 'water:terrain-revision-mismatch',
      details: {
        terrainRevision: terrain.revision,
        waterRevision: water.sourceTerrainRevision,
      },
    });
  }
}

function levelAt(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function canonicalTriangle(
  terrain: TerrainSnapshot,
  cellX: number,
  cellZ: number,
  localTriangleIndex: 0 | 1,
): readonly [TriangleVertex, TriangleVertex, TriangleVertex] {
  const corners = {
    nw: levelAt(terrain, cellX, cellZ),
    ne: levelAt(terrain, cellX + 1, cellZ),
    sw: levelAt(terrain, cellX, cellZ + 1),
    se: levelAt(terrain, cellX + 1, cellZ + 1),
  };
  const names = CELL_TRIANGLES[selectTerrainDiagonal(corners)][localTriangleIndex];
  return names.map((corner) => {
    const offset = CORNER_OFFSETS[corner];
    return {
      x: cellX + offset.x,
      z: cellZ + offset.z,
      level: corners[corner],
    };
  }) as unknown as readonly [TriangleVertex, TriangleVertex, TriangleVertex];
}

function pointOrder(first: LatticePoint, second: LatticePoint): number {
  return first.z === second.z ? first.x - second.x : first.z - second.z;
}

function edgeKey(first: LatticePoint, second: LatticePoint): string {
  const [start, end] = pointOrder(first, second) <= 0 ? [first, second] : [second, first];
  return `${start.x},${start.z}|${end.x},${end.z}`;
}

function quantizedPoint(point: LatticePoint): string {
  return `${Math.round(point.x * 1e9)},${Math.round(point.z * 1e9)}`;
}

function segmentKey(segment: ShorelineSegment): string {
  const first = quantizedPoint(segment.start);
  const second = quantizedPoint(segment.end);
  return first <= second ? `${first}|${second}` : `${second}|${first}`;
}

function interpolatePoint(first: TriangleVertex, second: TriangleVertex, t: number): LatticePoint {
  return {
    x: first.x + (second.x - first.x) * t,
    z: first.z + (second.z - first.z) * t,
  };
}

function pointOnEdge(point: LatticePoint, first: TriangleVertex, second: TriangleVertex): boolean {
  const cross =
    (point.x - first.x) * (second.z - first.z) - (point.z - first.z) * (second.x - first.x);
  if (Math.abs(cross) > WATER_GEOMETRY_EPSILON) return false;
  return (
    point.x >= Math.min(first.x, second.x) - WATER_GEOMETRY_EPSILON &&
    point.x <= Math.max(first.x, second.x) + WATER_GEOMETRY_EPSILON &&
    point.z >= Math.min(first.z, second.z) - WATER_GEOMETRY_EPSILON &&
    point.z <= Math.max(first.z, second.z) + WATER_GEOMETRY_EPSILON
  );
}

function isOriginalEdgeSegment(
  start: LatticePoint,
  end: LatticePoint,
  triangle: readonly [TriangleVertex, TriangleVertex, TriangleVertex],
): boolean {
  for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
    const first = triangle[edgeIndex]!;
    const second = triangle[(edgeIndex + 1) % 3]!;
    if (pointOnEdge(start, first, second) && pointOnEdge(end, first, second)) return true;
  }
  return false;
}

function buildSeaEdgeMembers(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  chunk: ChunkCoord,
  config: WorldConfig,
): Map<string, number[]> {
  const bounds = chunkCellBounds(chunk, config);
  const minX = Math.max(0, bounds.minCellX - 1);
  const minZ = Math.max(0, bounds.minCellZ - 1);
  const maxX = Math.min(terrain.width - 1, bounds.maxCellX + 1);
  const maxZ = Math.min(terrain.height - 1, bounds.maxCellZ + 1);
  const members = new Map<string, number[]>();

  for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (const localTriangleIndex of [0, 1] as const) {
        const index = triangleIndexFor(cellX, cellZ, localTriangleIndex, terrain.width);
        if (water.seaTriangleMask[index] !== 1) continue;
        const triangle = canonicalTriangle(terrain, cellX, cellZ, localTriangleIndex);
        for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
          const first = triangle[edgeIndex]!;
          const second = triangle[(edgeIndex + 1) % 3]!;
          const interval = wetIntervalForEdge(first.level, second.level, water.seaLevel);
          if (interval === null || interval.end - interval.start <= WATER_GEOMETRY_EPSILON) {
            continue;
          }
          const key = edgeKey(first, second);
          const values = members.get(key);
          if (values === undefined) members.set(key, [index]);
          else values.push(index);
        }
      }
    }
  }
  return members;
}

function colorAtDepth(terrainLevel: number, seaLevel: number): readonly [number, number, number] {
  const depth = Math.min(1, Math.max(0, seaLevel - terrainLevel));
  return [
    SHALLOW_COLOR[0] + (DEEP_COLOR[0] - SHALLOW_COLOR[0]) * depth,
    SHALLOW_COLOR[1] + (DEEP_COLOR[1] - SHALLOW_COLOR[1]) * depth,
    SHALLOW_COLOR[2] + (DEEP_COLOR[2] - SHALLOW_COLOR[2]) * depth,
  ];
}

function appendSurfaceVertex(
  positions: number[],
  normals: number[],
  colors: number[],
  vertex: WetVertex,
  waterY: number,
  terrain: TerrainSnapshot,
  config: WorldConfig,
): void {
  positions.push(
    (vertex.x - terrain.width / 2) * config.cellSize,
    waterY,
    (vertex.z - terrain.height / 2) * config.cellSize,
  );
  normals.push(0, 1, 0);
  colors.push(...colorAtDepth(vertex.terrainLevel, config.seaLevel));
}

function clipPolygonAxis(
  polygon: readonly LatticePoint[],
  inside: (point: LatticePoint) => boolean,
  intersect: (first: LatticePoint, second: LatticePoint) => LatticePoint,
): LatticePoint[] {
  const output: LatticePoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside) {
      if (!previousInside) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }
  return output;
}

function clipRibbonToChunk(
  polygon: readonly LatticePoint[],
  chunk: ChunkCoord,
  config: WorldConfig,
): LatticePoint[] {
  const bounds = chunkCellBounds(chunk, config);
  const minX = bounds.minCellX;
  const maxX = bounds.maxCellX + 1;
  const minZ = bounds.minCellZ;
  const maxZ = bounds.maxCellZ + 1;
  let result = [...polygon];

  result = clipPolygonAxis(
    result,
    (point) => point.x >= minX - WATER_GEOMETRY_EPSILON,
    (first, second) => {
      const t = (minX - first.x) / (second.x - first.x);
      return { x: minX, z: first.z + (second.z - first.z) * t };
    },
  );
  result = clipPolygonAxis(
    result,
    (point) => point.x <= maxX + WATER_GEOMETRY_EPSILON,
    (first, second) => {
      const t = (maxX - first.x) / (second.x - first.x);
      return { x: maxX, z: first.z + (second.z - first.z) * t };
    },
  );
  result = clipPolygonAxis(
    result,
    (point) => point.z >= minZ - WATER_GEOMETRY_EPSILON,
    (first, second) => {
      const t = (minZ - first.z) / (second.z - first.z);
      return { x: first.x + (second.x - first.x) * t, z: minZ };
    },
  );
  return clipPolygonAxis(
    result,
    (point) => point.z <= maxZ + WATER_GEOMETRY_EPSILON,
    (first, second) => {
      const t = (maxZ - first.z) / (second.z - first.z);
      return { x: first.x + (second.x - first.x) * t, z: maxZ };
    },
  );
}

function ribbonPolygon(segment: ShorelineSegment): LatticePoint[] {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const length = Math.hypot(dx, dz);
  if (length <= WATER_GEOMETRY_EPSILON) return [];
  const halfWidth = SHORELINE_WIDTH_CELLS / 2;
  const nx = (-dz / length) * halfWidth;
  const nz = (dx / length) * halfWidth;
  return [
    { x: segment.start.x + nx, z: segment.start.z + nz },
    { x: segment.end.x + nx, z: segment.end.z + nz },
    { x: segment.end.x - nx, z: segment.end.z - nz },
    { x: segment.start.x - nx, z: segment.start.z - nz },
  ];
}

function appendRibbon(
  segment: ShorelineSegment,
  positions: number[],
  colors: number[],
  indices: number[],
  chunk: ChunkCoord,
  terrain: TerrainSnapshot,
  config: WorldConfig,
): void {
  const polygon = clipRibbonToChunk(ribbonPolygon(segment), chunk, config);
  if (polygon.length < 3) return;
  const base = positions.length / 3;
  const y = config.seaLevel * config.heightStep + SHORELINE_OFFSET;
  for (const point of polygon) {
    positions.push(
      (point.x - terrain.width / 2) * config.cellSize,
      y,
      (point.z - terrain.height / 2) * config.cellSize,
    );
    colors.push(...SHORELINE_COLOR);
  }
  for (let index = 1; index < polygon.length - 1; index += 1) {
    const first = polygon[0]!;
    const second = polygon[index]!;
    const third = polygon[index + 1]!;
    const normalY =
      (second.z - first.z) * (third.x - first.x) - (second.x - first.x) * (third.z - first.z);
    if (normalY > 0) indices.push(base, base + index, base + index + 1);
    else indices.push(base, base + index + 1, base + index);
  }
}

function finiteBounds(
  positions: readonly number[],
  chunk: ChunkCoord,
  config: WorldConfig,
): WaterChunkMeshData['bounds'] {
  if (positions.length === 0) {
    const bounds = chunkCellBounds(chunk, config);
    const x = ((bounds.minCellX + bounds.maxCellX + 1) / 2 - config.mapWidth / 2) * config.cellSize;
    const z =
      ((bounds.minCellZ + bounds.maxCellZ + 1) / 2 - config.mapHeight / 2) * config.cellSize;
    const y = config.seaLevel * config.heightStep + WATER_SURFACE_OFFSET;
    return { min: { x, y, z }, max: { x, y, z } };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index]!;
    const y = positions[index + 1]!;
    const z = positions[index + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

export function buildWaterChunkMesh(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  chunk: ChunkCoord,
  config: WorldConfig,
): WaterChunkMeshData {
  assertCompatible(terrain, water);
  const bounds = chunkCellBounds(chunk, config);
  const seaEdgeMembers = buildSeaEdgeMembers(terrain, water, chunk, config);
  const surfacePositions: number[] = [];
  const surfaceNormals: number[] = [];
  const surfaceColors: number[] = [];
  const surfaceIndices: number[] = [];
  const shorelineSegments = new Map<string, ShorelineSegment>();
  const waterY = config.seaLevel * config.heightStep + WATER_SURFACE_OFFSET;

  for (let cellZ = bounds.minCellZ; cellZ <= bounds.maxCellZ; cellZ += 1) {
    for (let cellX = bounds.minCellX; cellX <= bounds.maxCellX; cellX += 1) {
      for (const localTriangleIndex of [0, 1] as const) {
        const triangleIndex = triangleIndexFor(cellX, cellZ, localTriangleIndex, terrain.width);
        if (water.seaTriangleMask[triangleIndex] !== 1) continue;
        const triangle = canonicalTriangle(terrain, cellX, cellZ, localTriangleIndex);
        const fragment = clipTriangleToSea(triangle, water.seaLevel);
        if (fragment === null) continue;

        const base = surfacePositions.length / 3;
        for (const vertex of fragment.vertices) {
          appendSurfaceVertex(
            surfacePositions,
            surfaceNormals,
            surfaceColors,
            vertex,
            waterY,
            terrain,
            config,
          );
        }
        for (let index = 1; index < fragment.vertices.length - 1; index += 1) {
          surfaceIndices.push(base, base + index, base + index + 1);
        }

        for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
          const first = triangle[edgeIndex]!;
          const second = triangle[(edgeIndex + 1) % 3]!;
          const interval = wetIntervalForEdge(first.level, second.level, water.seaLevel);
          if (
            interval === null ||
            interval.end - interval.start <= WATER_GEOMETRY_EPSILON ||
            (first.z === terrain.height && second.z === terrain.height)
          ) {
            continue;
          }
          const key = edgeKey(first, second);
          const hasSeaNeighbor = (seaEdgeMembers.get(key) ?? []).some(
            (candidate) => candidate !== triangleIndex,
          );
          if (!hasSeaNeighbor) {
            const segment = {
              start: interpolatePoint(first, second, interval.start),
              end: interpolatePoint(first, second, interval.end),
            };
            shorelineSegments.set(segmentKey(segment), segment);
          }
        }

        for (let index = 0; index < fragment.vertices.length; index += 1) {
          const first = fragment.vertices[index]!;
          const second = fragment.vertices[(index + 1) % fragment.vertices.length]!;
          if (!isOriginalEdgeSegment(first, second, triangle)) {
            const segment = {
              start: { x: first.x, z: first.z },
              end: { x: second.x, z: second.z },
            };
            shorelineSegments.set(segmentKey(segment), segment);
          }
        }
      }
    }
  }

  const shorelinePositions: number[] = [];
  const shorelineColors: number[] = [];
  const shorelineIndices: number[] = [];
  for (const segment of [...shorelineSegments.values()].sort((first, second) =>
    segmentKey(first).localeCompare(segmentKey(second)),
  )) {
    appendRibbon(
      segment,
      shorelinePositions,
      shorelineColors,
      shorelineIndices,
      chunk,
      terrain,
      config,
    );
  }

  if (
    surfacePositions.length / 3 > MAX_UINT16_VERTICES ||
    shorelinePositions.length / 3 > MAX_UINT16_VERTICES
  ) {
    throw new RangeError('water:chunk-vertex-capacity-exceeded');
  }
  const allPositions = [...surfacePositions, ...shorelinePositions];
  if (!allPositions.every(Number.isFinite)) throw new RangeError('water:non-finite-geometry');

  return Object.freeze({
    chunk: Object.freeze({ ...chunk }),
    sourceTerrainRevision: terrain.revision,
    surfacePositions: new Float32Array(surfacePositions),
    surfaceNormals: new Float32Array(surfaceNormals),
    surfaceColors: new Float32Array(surfaceColors),
    surfaceIndices: new Uint16Array(surfaceIndices),
    shorelinePositions: new Float32Array(shorelinePositions),
    shorelineColors: new Float32Array(shorelineColors),
    shorelineIndices: new Uint16Array(shorelineIndices),
    surfaceTriangleCount: surfaceIndices.length / 3,
    shorelineTriangleCount: shorelineIndices.length / 3,
    bounds: finiteBounds(allPositions, chunk, config),
  });
}
