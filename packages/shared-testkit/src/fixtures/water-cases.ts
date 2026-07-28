import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';

export const WATER_FIXTURE_NAMES = [
  'water-straight-coast',
  'water-diagonal-sw-ne',
  'water-diagonal-nw-se',
  'water-bay',
  'water-peninsula',
  'water-chunk-seam',
  'water-enclosed-basin',
  'water-open-channel',
  'water-corner-contact',
  'water-south-wall',
] as const;

export type WaterFixtureName = (typeof WATER_FIXTURE_NAMES)[number];

export interface WaterFixture {
  readonly name: WaterFixtureName;
  readonly terrain: TerrainSnapshot;
  readonly expectedSeaTriangleCount: number;
  readonly expectedEnclosedWetTriangleCount: number;
}

const EXPECTED_COUNTS: Readonly<
  Record<WaterFixtureName, Readonly<{ sea: number; enclosed: number }>>
> = Object.freeze({
  'water-straight-coast': { sea: 4352, enclosed: 0 },
  'water-diagonal-sw-ne': { sea: 1794, enclosed: 0 },
  'water-diagonal-nw-se': { sea: 1794, enclosed: 0 },
  'water-bay': { sea: 5116, enclosed: 0 },
  'water-peninsula': { sea: 4960, enclosed: 2 },
  'water-chunk-seam': { sea: 8482, enclosed: 0 },
  'water-enclosed-basin': { sea: 0, enclosed: 200 },
  'water-open-channel': { sea: 770, enclosed: 0 },
  'water-corner-contact': { sea: 3078, enclosed: 134 },
  'water-south-wall': { sea: 1476, enclosed: 0 },
});

function latticeIndex(x: number, z: number): number {
  return z * (WORLD_CONFIG.mapWidth + 1) + x;
}

function fillRect(
  levels: Uint8Array,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  level: number,
): void {
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      levels[latticeIndex(x, z)] = level;
    }
  }
}

function createLevels(name: WaterFixtureName): Uint8Array {
  const levels = new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1));
  levels.fill(2);

  switch (name) {
    case 'water-straight-coast':
      fillRect(levels, 0, 128, 111, 111, 1);
      fillRect(levels, 0, 128, 112, 128, 0);
      break;
    case 'water-diagonal-sw-ne':
      fillRect(levels, 0, 128, 121, 128, 1);
      levels[latticeIndex(63, 120)] = 2;
      levels[latticeIndex(64, 120)] = 1;
      levels[latticeIndex(63, 121)] = 1;
      levels[latticeIndex(64, 121)] = 1;
      break;
    case 'water-diagonal-nw-se':
      fillRect(levels, 0, 128, 121, 128, 1);
      levels[latticeIndex(63, 120)] = 1;
      levels[latticeIndex(64, 120)] = 2;
      levels[latticeIndex(63, 121)] = 1;
      levels[latticeIndex(64, 121)] = 1;
      break;
    case 'water-bay':
      fillRect(levels, 0, 128, 112, 128, 1);
      fillRect(levels, 42, 86, 103, 119, 1);
      fillRect(levels, 50, 78, 99, 111, 1);
      break;
    case 'water-peninsula':
      fillRect(levels, 0, 128, 107, 107, 1);
      fillRect(levels, 0, 128, 108, 128, 0);
      fillRect(levels, 57, 71, 95, 122, 1);
      fillRect(levels, 58, 70, 96, 121, 2);
      break;
    case 'water-chunk-seam':
      fillRect(levels, 0, 128, 96, 128, 0);
      fillRect(levels, 0, 128, 95, 95, 1);
      fillRect(levels, 62, 66, 91, 96, 1);
      break;
    case 'water-enclosed-basin':
      fillRect(levels, 47, 57, 47, 57, 1);
      fillRect(levels, 48, 56, 48, 56, 0);
      break;
    case 'water-open-channel':
      fillRect(levels, 47, 57, 47, 57, 1);
      fillRect(levels, 48, 56, 48, 56, 0);
      fillRect(levels, 50, 54, 55, 128, 1);
      fillRect(levels, 51, 53, 56, 128, 0);
      break;
    case 'water-corner-contact':
      fillRect(levels, 0, 128, 116, 128, 1);
      fillRect(levels, 48, 54, 48, 54, 1);
      for (let offset = 0; offset <= 60; offset += 2) {
        fillRect(levels, 54 + offset, 55 + offset, 54 + offset, 55 + offset, 1);
      }
      levels[latticeIndex(115, 115)] = 1;
      levels[latticeIndex(116, 116)] = 1;
      break;
    case 'water-south-wall':
      fillRect(levels, 7, 45, 119, 128, 1);
      fillRect(levels, 8, 44, 120, 128, 0);
      fillRect(levels, 75, 119, 119, 128, 1);
      fillRect(levels, 76, 118, 120, 128, 0);
      break;
  }

  return levels;
}

export function createWaterFixture(name: WaterFixtureName): WaterFixture {
  const fixtureIndex = WATER_FIXTURE_NAMES.indexOf(name);
  if (fixtureIndex < 0) throw new RangeError(`water-fixture:unknown:${name}`);
  const counts = EXPECTED_COUNTS[name];
  return Object.freeze({
    name,
    terrain: createTerrainMap({
      config: WORLD_CONFIG,
      heightLevels: createLevels(name),
      seed: 7001 + fixtureIndex,
      generatorVersion: 'coastal-v1',
      generationAttempt: 0,
      revision: 1,
    }),
    expectedSeaTriangleCount: counts.sea,
    expectedEnclosedWetTriangleCount: counts.enclosed,
  });
}
