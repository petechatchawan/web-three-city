import type { GridVertexCoord, WorldConfig } from '@web-three-city/world-core';

export type TerrainValidationIssueCode =
  | 'terrain:invalid-lattice-length'
  | 'terrain:invalid-height-range'
  | 'terrain:non-integer-height'
  | 'terrain:neighbor-delta-exceeded';

export interface TerrainValidationIssue {
  readonly code: TerrainValidationIssueCode;
  readonly index?: number;
  readonly value?: number;
  readonly coordinate?: GridVertexCoord;
  readonly neighbor?: GridVertexCoord;
  readonly expected?: number;
  readonly actual?: number;
}

export function validateTerrainInput(
  levels: ArrayLike<number>,
  config: WorldConfig,
): readonly TerrainValidationIssue[] {
  const latticeWidth = config.mapWidth + 1;
  const latticeHeight = config.mapHeight + 1;
  const expectedLength = latticeWidth * latticeHeight;

  if (levels.length !== expectedLength) {
    return [
      {
        code: 'terrain:invalid-lattice-length',
        expected: expectedLength,
        actual: levels.length,
      },
    ];
  }

  const issues: TerrainValidationIssue[] = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const value = levels[index] ?? Number.NaN;
    if (!Number.isInteger(value)) {
      issues.push({ code: 'terrain:non-integer-height', index, value });
    }
    if (value < config.minHeightLevel || value > config.maxHeightLevel) {
      issues.push({ code: 'terrain:invalid-height-range', index, value });
    }
  }

  const reportDelta = (a: GridVertexCoord, b: GridVertexCoord): void => {
    const aValue = levels[a.z * latticeWidth + a.x] ?? Number.NaN;
    const bValue = levels[b.z * latticeWidth + b.x] ?? Number.NaN;
    if (Math.abs(aValue - bValue) > 1) {
      issues.push({
        code: 'terrain:neighbor-delta-exceeded',
        coordinate: a,
        neighbor: b,
      });
    }
  };

  for (let z = 0; z < latticeHeight; z += 1) {
    for (let x = 0; x < latticeWidth; x += 1) {
      if (x + 1 < latticeWidth) reportDelta({ x, z }, { x: x + 1, z });
      if (z + 1 < latticeHeight) reportDelta({ x, z }, { x, z: z + 1 });
    }
  }

  return issues;
}
