import type { WorldConfig } from '@web-three-city/world-core';
import type { TerrainMap } from '@web-three-city/terrain-core';

export interface TerrainStatistics {
  readonly fullyDryCellCount: number;
  readonly fullyWaterCellCount: number;
  readonly shorelineCellCount: number;
  readonly flatBuildableCellCount: number;
  readonly largestBuildableSquare: number;
  readonly largestLandmassCellCount: number;
  readonly level4PlateauCellCount: number;
  readonly isolatedSpikeCount: number;
  readonly isolatedPitCount: number;
  readonly maxCardinalVertexDelta: number;
  readonly fullyWaterRatio: number;
  readonly flatBuildableRatio: number;
  readonly largestLandmassRatio: number;
  readonly level4PlateauRatio: number;
}

function largestBuildableSquare(mask: Uint8Array, width: number, height: number): number {
  const previous = new Int32Array(width + 1);
  const current = new Int32Array(width + 1);
  let largest = 0;

  for (let z = 1; z <= height; z += 1) {
    current.fill(0);
    for (let x = 1; x <= width; x += 1) {
      if (mask[(z - 1) * width + (x - 1)] === 1) {
        current[x] = 1 + Math.min(previous[x]!, current[x - 1]!, previous[x - 1]!);
        largest = Math.max(largest, current[x]!);
      }
    }
    previous.set(current);
  }

  return largest;
}

function largestLandmass(mask: Uint8Array, width: number, height: number): number {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let largest = 0;

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start] === 1) continue;

    let head = 0;
    let tail = 0;
    let count = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++]!;
      count += 1;
      const x = index % width;
      const z = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        z > 0 ? index - width : -1,
        z + 1 < height ? index + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] === 1 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }

    largest = Math.max(largest, count);
  }

  return largest;
}

function countIsolatedExtrema(
  levels: Uint8Array,
  latticeWidth: number,
  latticeHeight: number,
): readonly [number, number] {
  let spikes = 0;
  let pits = 0;

  for (let z = 1; z < latticeHeight - 1; z += 1) {
    for (let x = 1; x < latticeWidth - 1; x += 1) {
      const center = levels[z * latticeWidth + x]!;
      let spike = true;
      let pit = true;
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dz === 0) continue;
          const neighbor = levels[(z + dz) * latticeWidth + (x + dx)]!;
          spike = spike && neighbor === center - 1;
          pit = pit && neighbor === center + 1;
        }
      }
      if (spike) spikes += 1;
      if (pit) pits += 1;
    }
  }

  return [spikes, pits];
}

export function calculateTerrainStatistics(
  map: TerrainMap,
  config: WorldConfig,
): TerrainStatistics {
  const width = config.mapWidth;
  const height = config.mapHeight;
  const latticeWidth = width + 1;
  const dryMask = new Uint8Array(width * height);
  const buildableMask = new Uint8Array(width * height);
  let fullyDryCellCount = 0;
  let fullyWaterCellCount = 0;
  let shorelineCellCount = 0;
  let flatBuildableCellCount = 0;
  let level4PlateauCellCount = 0;

  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const nw = map.heightLevels[z * latticeWidth + x]!;
      const ne = map.heightLevels[z * latticeWidth + x + 1]!;
      const sw = map.heightLevels[(z + 1) * latticeWidth + x]!;
      const se = map.heightLevels[(z + 1) * latticeWidth + x + 1]!;
      const dry = nw > config.seaLevel && ne > config.seaLevel && sw > config.seaLevel && se > config.seaLevel;
      const water = nw <= config.seaLevel && ne <= config.seaLevel && sw <= config.seaLevel && se <= config.seaLevel;
      const flat = nw === ne && nw === sw && nw === se;
      const index = z * width + x;

      if (dry) {
        dryMask[index] = 1;
        fullyDryCellCount += 1;
      }
      if (water) fullyWaterCellCount += 1;
      if (!dry && !water) shorelineCellCount += 1;
      if (flat && dry) {
        buildableMask[index] = 1;
        flatBuildableCellCount += 1;
      }
      if (flat && nw === config.maxHeightLevel) level4PlateauCellCount += 1;
    }
  }

  let maxCardinalVertexDelta = 0;
  for (let z = 0; z <= height; z += 1) {
    for (let x = 0; x <= width; x += 1) {
      const index = z * latticeWidth + x;
      if (x < width) {
        maxCardinalVertexDelta = Math.max(
          maxCardinalVertexDelta,
          Math.abs(map.heightLevels[index]! - map.heightLevels[index + 1]!),
        );
      }
      if (z < height) {
        maxCardinalVertexDelta = Math.max(
          maxCardinalVertexDelta,
          Math.abs(map.heightLevels[index]! - map.heightLevels[index + latticeWidth]!),
        );
      }
    }
  }

  const [isolatedSpikeCount, isolatedPitCount] = countIsolatedExtrema(
    map.heightLevels,
    latticeWidth,
    height + 1,
  );
  const totalCells = width * height;
  const largestLandmassCellCount = largestLandmass(dryMask, width, height);

  return {
    fullyDryCellCount,
    fullyWaterCellCount,
    shorelineCellCount,
    flatBuildableCellCount,
    largestBuildableSquare: largestBuildableSquare(buildableMask, width, height),
    largestLandmassCellCount,
    level4PlateauCellCount,
    isolatedSpikeCount,
    isolatedPitCount,
    maxCardinalVertexDelta,
    fullyWaterRatio: fullyWaterCellCount / totalCells,
    flatBuildableRatio: flatBuildableCellCount / totalCells,
    largestLandmassRatio: largestLandmassCellCount / totalCells,
    level4PlateauRatio: level4PlateauCellCount / totalCells,
  };
}
