import { SHAPE_ATLAS_FIXTURES } from '@web-three-city/shared-testkit';
import { createTerrainMap } from '@web-three-city/terrain-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { WORLD_CONFIG } from '@web-three-city/world-core';

export type FixtureId = 'coastal' | 'shape-atlas' | 'chunk-seam' | 'boundary-skirt' | 'picking';

export type DiagnosticShapeId =
  | 'ramp-north'
  | 'ramp-south'
  | 'ramp-east'
  | 'ramp-west'
  | 'single-corner-high'
  | 'single-corner-low'
  | 'raised-plateau'
  | 'basin'
  | 'staircase'
  | 'diagonal-ridge'
  | 'diagonal-valley'
  | 'saddle-twist';

export interface TerrainFixture {
  readonly id: FixtureId;
  readonly name: string;
  readonly snapshot: TerrainSnapshot;
}

const CURATED_SEED = 1464156977;
const DIAGNOSTIC_SHAPES = new Set<DiagnosticShapeId>([
  'ramp-north',
  'ramp-south',
  'ramp-east',
  'ramp-west',
  'single-corner-high',
  'single-corner-low',
  'raised-plateau',
  'basin',
  'staircase',
  'diagonal-ridge',
  'diagonal-valley',
  'saddle-twist',
]);

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

function createShapeMatrix(shape: DiagnosticShapeId): Uint8Array {
  const matrix = new Uint8Array(64).fill(2);
  const set = (x: number, z: number, level: number): void => {
    matrix[z * 8 + x] = level;
  };

  for (let z = 0; z < 8; z += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (shape === 'ramp-north') set(x, z, z < 4 ? 3 : 2);
      else if (shape === 'ramp-south') set(x, z, z < 4 ? 2 : 3);
      else if (shape === 'ramp-east') set(x, z, x < 4 ? 2 : 3);
      else if (shape === 'ramp-west') set(x, z, x < 4 ? 3 : 2);
      else if (shape === 'raised-plateau') set(x, z, x >= 2 && x <= 5 && z >= 2 && z <= 5 ? 3 : 2);
      else if (shape === 'basin') set(x, z, x >= 2 && x <= 5 && z >= 2 && z <= 5 ? 2 : 3);
      else if (shape === 'diagonal-ridge') set(x, z, (x + z) % 2 === 0 ? 3 : 2);
      else if (shape === 'diagonal-valley') set(x, z, (x + z) % 2 === 0 ? 2 : 3);
      else if (shape === 'saddle-twist') set(x, z, x < 4 === z < 4 ? 3 : 2);
    }
  }

  if (shape === 'staircase') {
    const rows = [
      [2, 2, 2, 2, 2, 2, 2, 2],
      [2, 3, 3, 3, 3, 3, 3, 2],
      [2, 3, 4, 4, 4, 4, 3, 2],
      [2, 3, 4, 4, 4, 4, 3, 2],
      [2, 3, 3, 3, 3, 3, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2, 2],
    ] as const;
    rows.forEach((row, z) => row.forEach((level, x) => set(x, z, level)));
  }

  if (shape === 'single-corner-high') matrix[4 * 8 + 4] = 3;
  if (shape === 'single-corner-low') {
    matrix.fill(3);
    matrix[4 * 8 + 4] = 2;
  }

  return matrix;
}

function createFocusedShapeSnapshot(shape: DiagnosticShapeId): TerrainSnapshot {
  const latticeWidth = WORLD_CONFIG.mapWidth + 1;
  const levels = new Uint8Array(latticeWidth * (WORLD_CONFIG.mapHeight + 1)).fill(2);
  const matrix = createShapeMatrix(shape);
  const startX = 60;
  const startZ = 60;

  for (let z = 0; z < 8; z += 1) {
    for (let x = 0; x < 8; x += 1) {
      levels[(startZ + z) * latticeWidth + startX + x] = matrix[z * 8 + x]!;
    }
  }

  return createSnapshot(levels, 1100 + [...DIAGNOSTIC_SHAPES].indexOf(shape));
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

function isDiagnosticShape(value: string | null): value is DiagnosticShapeId {
  return value !== null && DIAGNOSTIC_SHAPES.has(value as DiagnosticShapeId);
}

export function resolveFixture(input: string | null, shape: string | null = null): TerrainFixture {
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
    return {
      id,
      name: 'ShapeAtlasFixture',
      snapshot: isDiagnosticShape(shape)
        ? createFocusedShapeSnapshot(shape)
        : createShapeAtlasSnapshot(),
    };
  }
  if (id === 'chunk-seam') {
    return { id, name: 'ChunkSeamFixture', snapshot: createChunkSeamSnapshot() };
  }
  if (id === 'boundary-skirt') {
    return { id, name: 'BoundarySkirtFixture', snapshot: createFlatSnapshot(1003) };
  }
  return { id, name: 'PickingFixture', snapshot: createFlatSnapshot(1004) };
}
