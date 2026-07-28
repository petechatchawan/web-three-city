import {
  CELL_TRIANGLES,
  selectTerrainDiagonal,
  type TerrainCorner,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import type { WaterError } from './errors.js';
import { OCEAN_POLICY_V1, WATER_GEOMETRY_EPSILON } from './policy.js';
import {
  clipTriangleToSea,
  wetIntervalForEdge,
  type TriangleVertex,
  type WetFragment,
} from './wet-fragment.js';

export interface WaterSnapshot {
  readonly schemaVersion: 1;
  readonly policyVersion: 'south-edge-sea-v1';
  readonly width: number;
  readonly height: number;
  readonly seaLevel: number;
  readonly sourceTerrainRevision: number;
  readonly sourceTerrainSeed: number;
  readonly seaTriangleMask: Uint8Array;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
}

interface LatticePoint {
  readonly x: number;
  readonly z: number;
}

interface TriangleRecord {
  readonly index: number;
  readonly vertices: readonly [TriangleVertex, TriangleVertex, TriangleVertex];
  readonly fragment: WetFragment;
  readonly edgeKeys: readonly string[];
  readonly southBoundaryEdgeKeys: ReadonlySet<string>;
}

const CORNER_COORD_OFFSETS: Readonly<Record<TerrainCorner, LatticePoint>> = Object.freeze({
  nw: Object.freeze({ x: 0, z: 0 }),
  ne: Object.freeze({ x: 1, z: 0 }),
  sw: Object.freeze({ x: 0, z: 1 }),
  se: Object.freeze({ x: 1, z: 1 }),
});

export function triangleIndexFor(
  cellX: number,
  cellZ: number,
  localTriangleIndex: 0 | 1,
  mapWidth: number,
): number {
  return (cellZ * mapWidth + cellX) * 2 + localTriangleIndex;
}

function latticeLevel(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function triangleVertices(
  terrain: TerrainSnapshot,
  cellX: number,
  cellZ: number,
  localTriangleIndex: 0 | 1,
): readonly [TriangleVertex, TriangleVertex, TriangleVertex] {
  const corners = {
    nw: latticeLevel(terrain, cellX, cellZ),
    ne: latticeLevel(terrain, cellX + 1, cellZ),
    sw: latticeLevel(terrain, cellX, cellZ + 1),
    se: latticeLevel(terrain, cellX + 1, cellZ + 1),
  };
  const diagonal = selectTerrainDiagonal(corners);
  const names = CELL_TRIANGLES[diagonal][localTriangleIndex];
  return names.map((corner) => {
    const offset = CORNER_COORD_OFFSETS[corner];
    return Object.freeze({
      x: cellX + offset.x,
      z: cellZ + offset.z,
      level: corners[corner],
    });
  }) as unknown as readonly [TriangleVertex, TriangleVertex, TriangleVertex];
}

function pointOrder(first: LatticePoint, second: LatticePoint): number {
  return first.z === second.z ? first.x - second.x : first.z - second.z;
}

function edgeKey(first: LatticePoint, second: LatticePoint): string {
  const [start, end] = pointOrder(first, second) <= 0 ? [first, second] : [second, first];
  return `${start.x},${start.z}|${end.x},${end.z}`;
}

function isSouthBoundaryEdge(
  first: LatticePoint,
  second: LatticePoint,
  mapHeight: number,
): boolean {
  return first.z === mapHeight && second.z === mapHeight;
}

function validatesTerrain(terrain: TerrainSnapshot, config: WorldConfig): WaterError | null {
  if (terrain.width !== config.mapWidth || terrain.height !== config.mapHeight) {
    return { code: 'water:invalid-terrain-dimensions' };
  }
  const expectedLength = (terrain.width + 1) * (terrain.height + 1);
  if (terrain.heightLevels.length !== expectedLength) {
    return { code: 'water:invalid-height-lattice' };
  }
  if (!Number.isInteger(terrain.revision) || terrain.revision < 0) {
    return { code: 'water:invalid-terrain-revision' };
  }
  if (
    !Number.isInteger(config.seaLevel) ||
    config.seaLevel < config.minHeightLevel ||
    config.seaLevel > config.maxHeightLevel
  ) {
    return { code: 'water:invalid-sea-level' };
  }
  return null;
}

function pointOnOriginalEdge(
  point: Readonly<{ x: number; z: number }>,
  first: TriangleVertex,
  second: TriangleVertex,
): boolean {
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

function countClippingSegments(record: TriangleRecord): number {
  let count = 0;
  const polygon = record.fragment.vertices;
  for (let index = 0; index < polygon.length; index += 1) {
    const first = polygon[index]!;
    const second = polygon[(index + 1) % polygon.length]!;
    let onOriginalEdge = false;
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const edgeFirst = record.vertices[edgeIndex]!;
      const edgeSecond = record.vertices[(edgeIndex + 1) % 3]!;
      if (
        pointOnOriginalEdge(first, edgeFirst, edgeSecond) &&
        pointOnOriginalEdge(second, edgeFirst, edgeSecond)
      ) {
        onOriginalEdge = true;
        break;
      }
    }
    if (!onOriginalEdge) count += 1;
  }
  return count;
}

export function deriveWaterSnapshot(
  terrain: TerrainSnapshot,
  config: WorldConfig,
): Result<WaterSnapshot, WaterError> {
  const validationError = validatesTerrain(terrain, config);
  if (validationError !== null) return err(validationError);

  const triangleCount = terrain.width * terrain.height * 2;
  const records: Array<TriangleRecord | null> = Array.from({ length: triangleCount }, () => null);
  const edgeMembers = new Map<string, number[]>();
  const adjacency: number[][] = Array.from({ length: triangleCount }, () => []);
  const seedIndices: number[] = [];

  for (let cellZ = 0; cellZ < terrain.height; cellZ += 1) {
    for (let cellX = 0; cellX < terrain.width; cellX += 1) {
      for (const localTriangleIndex of [0, 1] as const) {
        const index = triangleIndexFor(cellX, cellZ, localTriangleIndex, terrain.width);
        const vertices = triangleVertices(terrain, cellX, cellZ, localTriangleIndex);
        const fragment = clipTriangleToSea(vertices, config.seaLevel);
        if (fragment === null) continue;

        const edgeKeys: string[] = [];
        const southBoundaryEdgeKeys = new Set<string>();
        for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
          const first = vertices[edgeIndex]!;
          const second = vertices[(edgeIndex + 1) % 3]!;
          const interval = wetIntervalForEdge(first.level, second.level, config.seaLevel);
          if (interval === null || interval.end - interval.start <= WATER_GEOMETRY_EPSILON) {
            continue;
          }
          const key = edgeKey(first, second);
          edgeKeys.push(key);
          const members = edgeMembers.get(key);
          if (members === undefined) edgeMembers.set(key, [index]);
          else members.push(index);
          if (isSouthBoundaryEdge(first, second, terrain.height)) {
            southBoundaryEdgeKeys.add(key);
          }
        }

        records[index] = Object.freeze({
          index,
          vertices,
          fragment,
          edgeKeys: Object.freeze(edgeKeys),
          southBoundaryEdgeKeys,
        });
        if (southBoundaryEdgeKeys.size > 0) seedIndices.push(index);
      }
    }
  }

  for (const members of edgeMembers.values()) {
    members.sort((first, second) => first - second);
    for (let firstIndex = 0; firstIndex < members.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < members.length; secondIndex += 1) {
        const first = members[firstIndex]!;
        const second = members[secondIndex]!;
        adjacency[first]!.push(second);
        adjacency[second]!.push(first);
      }
    }
  }
  for (const neighbors of adjacency) neighbors.sort((first, second) => first - second);

  seedIndices.sort((first, second) => first - second);
  const seaTriangleMask = new Uint8Array(triangleCount);
  const queue = [...new Set(seedIndices)];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex++]!;
    if (seaTriangleMask[current] === 1 || records[current] === null) continue;
    seaTriangleMask[current] = 1;
    for (const neighbor of adjacency[current]!) {
      if (seaTriangleMask[neighbor] === 0) queue.push(neighbor);
    }
  }

  let seaTriangleCount = 0;
  let enclosedWetTriangleCount = 0;
  let shorelineSegmentCount = 0;
  for (const record of records) {
    if (record === null) continue;
    if (seaTriangleMask[record.index] === 0) {
      enclosedWetTriangleCount += 1;
      continue;
    }
    seaTriangleCount += 1;
    shorelineSegmentCount += countClippingSegments(record);
    for (const key of record.edgeKeys) {
      if (record.southBoundaryEdgeKeys.has(key)) continue;
      const hasSeaNeighbor = (edgeMembers.get(key) ?? []).some(
        (candidate) => candidate !== record.index && seaTriangleMask[candidate] === 1,
      );
      if (!hasSeaNeighbor) shorelineSegmentCount += 1;
    }
  }

  return ok(
    Object.freeze({
      schemaVersion: 1 as const,
      policyVersion: OCEAN_POLICY_V1.version,
      width: terrain.width,
      height: terrain.height,
      seaLevel: config.seaLevel,
      sourceTerrainRevision: terrain.revision,
      sourceTerrainSeed: terrain.seed,
      seaTriangleMask,
      seaTriangleCount,
      enclosedWetTriangleCount,
      shorelineSegmentCount,
    }),
  );
}
