import type { WorldConfig } from '@web-three-city/world-core';
import type { OuterSkirtMeshData } from './mesh-data.js';
import type { TerrainMap } from './terrain-map.js';

interface BoundaryPoint {
  readonly x: number;
  readonly z: number;
}

interface BoundarySide {
  readonly normal: readonly [number, number, number];
  readonly points: readonly BoundaryPoint[];
}

function perimeterSides(map: TerrainMap): readonly BoundarySide[] {
  const north = Array.from({ length: map.width + 1 }, (_, x) => ({ x, z: 0 }));
  const east = Array.from({ length: map.height + 1 }, (_, z) => ({ x: map.width, z }));
  const south = Array.from({ length: map.width + 1 }, (_, offset) => ({
    x: map.width - offset,
    z: map.height,
  }));
  const west = Array.from({ length: map.height + 1 }, (_, offset) => ({
    x: 0,
    z: map.height - offset,
  }));

  return [
    { normal: [0, 0, -1], points: north },
    { normal: [1, 0, 0], points: east },
    { normal: [0, 0, 1], points: south },
    { normal: [-1, 0, 0], points: west },
  ];
}

export function buildOuterSkirtMesh(map: TerrainMap, config: WorldConfig): OuterSkirtMeshData {
  const sides = perimeterSides(map);
  const segmentCount = map.width * 2 + map.height * 2;
  const positions = new Float32Array(segmentCount * 4 * 3);
  const normals = new Float32Array(positions.length);
  const colors = new Float32Array(positions.length);
  const indices = new Uint16Array(segmentCount * 6);
  const latticeWidth = map.width + 1;
  let segment = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const side of sides) {
    for (let pointIndex = 0; pointIndex < side.points.length - 1; pointIndex += 1) {
      const first = side.points[pointIndex]!;
      const second = side.points[pointIndex + 1]!;
      const firstY = map.heightLevels[first.z * latticeWidth + first.x]! * config.heightStep;
      const secondY = map.heightLevels[second.z * latticeWidth + second.x]! * config.heightStep;
      const firstX = (first.x - map.width / 2) * config.cellSize;
      const firstZ = (first.z - map.height / 2) * config.cellSize;
      const secondX = (second.x - map.width / 2) * config.cellSize;
      const secondZ = (second.z - map.height / 2) * config.cellSize;
      const vertexOffset = segment * 12;
      const indexOffset = segment * 6;

      positions.set(
        [
          firstX,
          firstY,
          firstZ,
          secondX,
          secondY,
          secondZ,
          secondX,
          config.dioramaBaseY,
          secondZ,
          firstX,
          config.dioramaBaseY,
          firstZ,
        ],
        vertexOffset,
      );
      for (let vertex = 0; vertex < 4; vertex += 1) {
        const offset = vertexOffset + vertex * 3;
        normals.set(side.normal, offset);
        colors.set([0.31, 0.22, 0.13], offset);
      }
      const baseVertex = segment * 4;
      indices.set(
        [baseVertex, baseVertex + 2, baseVertex + 3, baseVertex, baseVertex + 1, baseVertex + 2],
        indexOffset,
      );
      minY = Math.min(minY, config.dioramaBaseY, firstY, secondY);
      maxY = Math.max(maxY, firstY, secondY);
      segment += 1;
    }
  }

  return {
    positions,
    normals,
    colors,
    indices,
    segmentCount,
    bounds: {
      min: {
        x: (-map.width / 2) * config.cellSize,
        y: minY,
        z: (-map.height / 2) * config.cellSize,
      },
      max: {
        x: (map.width / 2) * config.cellSize,
        y: maxY,
        z: (map.height / 2) * config.cellSize,
      },
    },
  };
}
