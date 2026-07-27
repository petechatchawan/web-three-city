import type { WorldConfig } from '@web-three-city/world-core';
import type { CanonicalNormalField } from './canonical-normals.js';
import { chunkCellBounds } from './chunking.js';
import type { ChunkCoord } from './chunking.js';
import type { TerrainChunkMeshData } from './mesh-data.js';
import type { TerrainMap } from './terrain-map.js';
import { selectTerrainDiagonal } from './topology.js';

function colorForLevel(level: number, maximum: number): readonly [number, number, number] {
  const normalized = maximum === 0 ? 0 : level / maximum;
  return [0.22 + normalized * 0.18, 0.42 + normalized * 0.28, 0.18 + normalized * 0.12];
}

export function buildTerrainChunkMesh(
  map: TerrainMap,
  canonical: CanonicalNormalField,
  chunk: ChunkCoord,
  config: WorldConfig,
): TerrainChunkMeshData {
  const bounds = chunkCellBounds(chunk, config);
  const cellWidth = bounds.maxCellX - bounds.minCellX + 1;
  const cellHeight = bounds.maxCellZ - bounds.minCellZ + 1;
  const vertexWidth = cellWidth + 1;
  const vertexHeight = cellHeight + 1;
  const positions = new Float32Array(vertexWidth * vertexHeight * 3);
  const normals = new Float32Array(positions.length);
  const colors = new Float32Array(positions.length);
  const indices = new Uint16Array(cellWidth * cellHeight * 6);
  const latticeWidth = map.width + 1;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let localZ = 0; localZ < vertexHeight; localZ += 1) {
    for (let localX = 0; localX < vertexWidth; localX += 1) {
      const globalX = bounds.minCellX + localX;
      const globalZ = bounds.minCellZ + localZ;
      const globalIndex = globalZ * latticeWidth + globalX;
      const localIndex = localZ * vertexWidth + localX;
      const offset = localIndex * 3;
      const level = map.heightLevels[globalIndex]!;
      const x = (globalX - map.width / 2) * config.cellSize;
      const y = level * config.heightStep;
      const z = (globalZ - map.height / 2) * config.cellSize;
      const [red, green, blue] = colorForLevel(level, config.maxHeightLevel);

      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      normals[offset] = canonical.normals[globalIndex * 3]!;
      normals[offset + 1] = canonical.normals[globalIndex * 3 + 1]!;
      normals[offset + 2] = canonical.normals[globalIndex * 3 + 2]!;
      colors[offset] = red;
      colors[offset + 1] = green;
      colors[offset + 2] = blue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }

  let indexOffset = 0;
  for (let localZ = 0; localZ < cellHeight; localZ += 1) {
    for (let localX = 0; localX < cellWidth; localX += 1) {
      const nw = localZ * vertexWidth + localX;
      const ne = nw + 1;
      const sw = nw + vertexWidth;
      const se = sw + 1;
      const globalX = bounds.minCellX + localX;
      const globalZ = bounds.minCellZ + localZ;
      const globalNw = globalZ * latticeWidth + globalX;
      const diagonal = selectTerrainDiagonal({
        nw: map.heightLevels[globalNw]!,
        ne: map.heightLevels[globalNw + 1]!,
        sw: map.heightLevels[globalNw + latticeWidth]!,
        se: map.heightLevels[globalNw + latticeWidth + 1]!,
      });

      if (diagonal === 'sw-ne') {
        indices.set([sw, se, ne, sw, ne, nw], indexOffset);
      } else {
        indices.set([sw, se, nw, se, ne, nw], indexOffset);
      }
      indexOffset += 6;
    }
  }

  return {
    chunk,
    positions,
    normals,
    colors,
    indices,
    bounds: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  };
}
