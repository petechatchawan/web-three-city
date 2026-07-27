import { SHAPE_ATLAS_FIXTURES } from '@web-three-city/shared-testkit';
import { createTerrainMap } from '@web-three-city/terrain-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { WORLD_CONFIG } from '@web-three-city/world-core';

export type FixtureId =
  | 'coastal'
  | 'shape-atlas'
  | 'chunk-seam'
  | 'boundary-skirt'
  | 'picking';

export interface TerrainFixture {
  readonly id: FixtureId;
  readonly name: string;
  readonly snapshot: TerrainSnapshot;
}

const CURATED_SEED = 1464156977;

function createSnapshot(levels: Uint8Array, seed: number): TerrainSnapshot {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: levels,
    seed,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
  });
}

function createShapeAtlasSnapshot(): TerrainSnapshot {
  const latticeWidth = WORLD_CONFIG.mapWidth + 1;
  const levels = new Uint8Array(latticeWidth * (WORLD_CONFIG.mapHeight + 1)).fill(2);

  SHAPE_ATLAS_FIXTURES.forEach((fixture, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const startX = 18 + column * 28;
    const startZ = 22 + row * 36;

    for (let localZ = 0; localZ < fixture.height; localZ += 1) {
      for (let localX = 0; localX < fixture.width; localX += 1) {
        levels[(startZ + localZ) * latticeWidth + startX + localX] =
          fixture.heightLevels[localZ * fixture.width + localX]!;
      }
    }
  });

  return createSnapshot(levels, 1001);
}

function createChunkSeamSnapshot(): TerrainSnapshot {
  const latticeWidth = WORLD_CONFIG.mapWidth + 1;
  const levels = new Uint8Array(latticeWidth * (WORLD_CONFIG.mapHeight + 1)).fill(2);
  for (let z = 0; z <= WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 16; x <= 32; x += 1) levels[z * latticeWidth + x] = 3;
  }
  return createSnapshot(levels, 1002);
}

function createFlatSnapshot(seed: number): TerrainSnapshot {
  return createSnapshot(
    new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(2),
    seed,
  );
}

export function resolveFixture(input: string | null): TerrainFixture {
  const id: FixtureId =
    input === 'shape-atlas' ||
    input === 'chunk-seam' ||
    input === 'boundary-skirt' ||
    input === 'picking'
      ? input
      : 'coastal';

  if (id === 'coastal') {
    const result = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
    if (!result.ok) throw new Error(`terrain-lab:generation-failed:${result.error.code}`);
    return { id, name: 'CoastalFixture', snapshot: result.value };
  }
  if (id === 'shape-atlas') {
    return { id, name: 'ShapeAtlasFixture', snapshot: createShapeAtlasSnapshot() };
  }
  if (id === 'chunk-seam') {
    return { id, name: 'ChunkSeamFixture', snapshot: createChunkSeamSnapshot() };
  }
  if (id === 'boundary-skirt') {
    return { id, name: 'BoundarySkirtFixture', snapshot: createFlatSnapshot(1003) };
  }
  return { id, name: 'PickingFixture', snapshot: createFlatSnapshot(1004) };
}
