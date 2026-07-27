import type { WorldConfig } from '@web-three-city/world-core';
import type { TerrainMap } from './terrain-map.js';
import { CELL_TRIANGLES, selectTerrainDiagonal } from './topology.js';
import type { TerrainCorner, TerrainCorners } from './topology.js';

export interface CanonicalNormalField {
  readonly latticeWidth: number;
  readonly latticeHeight: number;
  readonly normals: Float32Array;
}

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function cornerIndices(x: number, z: number, latticeWidth: number): Record<TerrainCorner, number> {
  const nw = z * latticeWidth + x;
  return {
    nw,
    ne: nw + 1,
    sw: nw + latticeWidth,
    se: nw + latticeWidth + 1,
  };
}

function cornerHeights(
  map: TerrainMap,
  indices: Readonly<Record<TerrainCorner, number>>,
): TerrainCorners {
  return {
    nw: map.heightLevels[indices.nw]!,
    ne: map.heightLevels[indices.ne]!,
    sw: map.heightLevels[indices.sw]!,
    se: map.heightLevels[indices.se]!,
  };
}

function pointForIndex(index: number, map: TerrainMap, config: WorldConfig): Point3 {
  const latticeWidth = map.width + 1;
  const x = index % latticeWidth;
  const z = Math.floor(index / latticeWidth);
  return {
    x: (x - map.width / 2) * config.cellSize,
    y: map.heightLevels[index]! * config.heightStep,
    z: (z - map.height / 2) * config.cellSize,
  };
}

function accumulateTriangle(
  accumulation: Float64Array,
  triangle: readonly number[],
  map: TerrainMap,
  config: WorldConfig,
): void {
  const first = pointForIndex(triangle[0]!, map, config);
  const second = pointForIndex(triangle[1]!, map, config);
  const third = pointForIndex(triangle[2]!, map, config);
  const abX = second.x - first.x;
  const abY = second.y - first.y;
  const abZ = second.z - first.z;
  const acX = third.x - first.x;
  const acY = third.y - first.y;
  const acZ = third.z - first.z;
  const normalX = abY * acZ - abZ * acY;
  const normalY = abZ * acX - abX * acZ;
  const normalZ = abX * acY - abY * acX;

  for (const vertexIndex of triangle) {
    const offset = vertexIndex * 3;
    accumulation[offset] += normalX;
    accumulation[offset + 1] += normalY;
    accumulation[offset + 2] += normalZ;
  }
}

export function buildCanonicalNormals(
  map: TerrainMap,
  config: WorldConfig,
): CanonicalNormalField {
  const latticeWidth = map.width + 1;
  const latticeHeight = map.height + 1;
  const accumulation = new Float64Array(latticeWidth * latticeHeight * 3);

  for (let z = 0; z < map.height; z += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const indices = cornerIndices(x, z, latticeWidth);
      const diagonal = selectTerrainDiagonal(cornerHeights(map, indices));
      for (const triangle of CELL_TRIANGLES[diagonal]) {
        accumulateTriangle(
          accumulation,
          triangle.map((corner) => indices[corner]),
          map,
          config,
        );
      }
    }
  }

  const normals = new Float32Array(accumulation.length);
  for (let index = 0; index < latticeWidth * latticeHeight; index += 1) {
    const offset = index * 3;
    const x = accumulation[offset]!;
    const y = accumulation[offset + 1]!;
    const z = accumulation[offset + 2]!;
    const length = Math.hypot(x, y, z);
    if (length <= Number.EPSILON) throw new Error('terrain:zero-normal');
    normals[offset] = x / length;
    normals[offset + 1] = y / length;
    normals[offset + 2] = z / length;
  }

  return { latticeWidth, latticeHeight, normals };
}
