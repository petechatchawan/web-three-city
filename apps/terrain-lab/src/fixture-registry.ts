import {
  commitRoadMutation,
  createEmptyRoadSnapshot,
  planRoadMutation,
  roadConnectionMaskAt,
  type RoadInvalidReason,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import {
  SHAPE_ATLAS_FIXTURES,
  WATER_FIXTURE_NAMES,
  createWaterFixture,
  type WaterFixtureName,
} from '@web-three-city/shared-testkit';
import {
  createTerrainMap,
  terrainCellSurfaceProfile,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import {
  deriveWaterSnapshot,
  triangleIndexFor,
  type WaterSnapshot,
} from '@web-three-city/water-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';

export const ROAD_FIXTURE_IDS = [
  'road-isolated',
  'road-end-north',
  'road-end-east',
  'road-end-south',
  'road-end-west',
  'road-straight-ns',
  'road-straight-ew',
  'road-corner-ne',
  'road-corner-es',
  'road-corner-sw',
  'road-corner-wn',
  'road-t-north',
  'road-t-east',
  'road-t-south',
  'road-t-west',
  'road-four-way',
  'road-ramp-north-up',
  'road-ramp-north-down',
  'road-ramp-east-up',
  'road-ramp-east-down',
  'road-invalid-ramp-perpendicular',
  'road-invalid-ramp-junction',
  'road-invalid-wet',
  'road-chunk-boundary',
] as const;

export type RoadFixtureId = (typeof ROAD_FIXTURE_IDS)[number];
export type FixtureId =
  | 'coastal'
  | 'shape-atlas'
  | 'chunk-seam'
  | 'boundary-skirt'
  | 'picking'
  | WaterFixtureName
  | RoadFixtureId;

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

export interface RoadFixtureState {
  readonly roads: RoadSnapshot;
  readonly environment: RoadPlacementEnvironment;
  readonly plan: RoadMutationPlan;
  readonly focusCell: CellCoord;
  readonly valid: boolean;
  readonly invalidReason: RoadInvalidReason | null;
  readonly connectionMask: number;
}

export interface TerrainFixture {
  readonly id: FixtureId;
  readonly name: string;
  readonly snapshot: TerrainSnapshot;
  readonly water?: WaterSnapshot;
  readonly road?: RoadFixtureState;
}

const CURATED_SEED = 1464156977;
const ROAD_CENTER = Object.freeze({ x: 64, z: 64 });
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
const ROAD_FIXTURE_SET = new Set<RoadFixtureId>(ROAD_FIXTURE_IDS);

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

function vertexOffset(x: number, z: number): number {
  return z * (WORLD_CONFIG.mapWidth + 1) + x;
}

function setVertex(levels: Uint8Array, x: number, z: number, level: number): void {
  levels[vertexOffset(x, z)] = level;
}

function applyNorthSouthRamp(
  levels: Uint8Array,
  cell: CellCoord,
  northLevel: number,
  southLevel: number,
): void {
  for (const x of [cell.x, cell.x + 1]) {
    setVertex(levels, x, cell.z - 1, northLevel);
    setVertex(levels, x, cell.z, northLevel);
    setVertex(levels, x, cell.z + 1, southLevel);
    setVertex(levels, x, cell.z + 2, southLevel);
  }
}

function applyEastWestRamp(
  levels: Uint8Array,
  cell: CellCoord,
  westLevel: number,
  eastLevel: number,
): void {
  for (const z of [cell.z, cell.z + 1]) {
    setVertex(levels, cell.x - 1, z, westLevel);
    setVertex(levels, cell.x, z, westLevel);
    setVertex(levels, cell.x + 1, z, eastLevel);
    setVertex(levels, cell.x + 2, z, eastLevel);
  }
}

function createFixtureRoadEnvironment(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: terrain.revision,
    waterSourceTerrainRevision: water.sourceTerrainRevision,
    surfaceAt(cell: CellCoord) {
      return terrainCellSurfaceProfile(terrain, cell, WORLD_CONFIG);
    },
    isDry(cell: CellCoord) {
      const first = triangleIndexFor(cell.x, cell.z, 0, WORLD_CONFIG.mapWidth);
      const second = triangleIndexFor(cell.x, cell.z, 1, WORLD_CONFIG.mapWidth);
      return water.seaTriangleMask[first] === 0 && water.seaTriangleMask[second] === 0;
    },
  });
}

function offsetCell(dx: number, dz: number): CellCoord {
  return Object.freeze({ x: ROAD_CENTER.x + dx, z: ROAD_CENTER.z + dz });
}

function cellsForRoadFixture(id: RoadFixtureId): readonly CellCoord[] {
  const center = offsetCell(0, 0);
  const north = offsetCell(0, -1);
  const east = offsetCell(1, 0);
  const south = offsetCell(0, 1);
  const west = offsetCell(-1, 0);
  switch (id) {
    case 'road-isolated':
      return [center];
    case 'road-end-north':
      return [center, north];
    case 'road-end-east':
      return [center, east];
    case 'road-end-south':
      return [center, south];
    case 'road-end-west':
      return [center, west];
    case 'road-straight-ns':
    case 'road-ramp-north-up':
    case 'road-ramp-north-down':
      return [north, center, south];
    case 'road-straight-ew':
    case 'road-ramp-east-up':
    case 'road-ramp-east-down':
    case 'road-invalid-ramp-perpendicular':
      return [west, center, east];
    case 'road-corner-ne':
      return [north, center, east];
    case 'road-corner-es':
      return [east, center, south];
    case 'road-corner-sw':
      return [south, center, west];
    case 'road-corner-wn':
      return [west, center, north];
    case 'road-t-north':
      return [west, center, east, north];
    case 'road-t-east':
      return [north, center, south, east];
    case 'road-t-south':
      return [west, center, east, south];
    case 'road-t-west':
      return [north, center, south, west];
    case 'road-four-way':
      return [north, east, south, west, center];
    case 'road-invalid-ramp-junction':
      return [north, center, south, east];
    case 'road-invalid-wet':
      return [Object.freeze({ x: ROAD_CENTER.x, z: WORLD_CONFIG.mapHeight - 1 })];
    case 'road-chunk-boundary':
      return [
        Object.freeze({ x: 15, z: ROAD_CENTER.z }),
        Object.freeze({ x: 16, z: ROAD_CENTER.z }),
        Object.freeze({ x: 17, z: ROAD_CENTER.z }),
      ];
  }
}

function createRoadFixture(id: RoadFixtureId): TerrainFixture {
  const wet = id === 'road-invalid-wet';
  const levels = new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
    wet ? 0 : 2,
  );

  if (id === 'road-invalid-ramp-perpendicular') {
    applyNorthSouthRamp(levels, offsetCell(-1, 0), 3, 2);
    applyNorthSouthRamp(levels, ROAD_CENTER, 3, 2);
    applyNorthSouthRamp(levels, offsetCell(1, 0), 3, 2);
  } else if (id === 'road-ramp-north-up' || id === 'road-invalid-ramp-junction') {
    applyNorthSouthRamp(levels, ROAD_CENTER, 3, 2);
  } else if (id === 'road-ramp-north-down') {
    applyNorthSouthRamp(levels, ROAD_CENTER, 2, 3);
  } else if (id === 'road-ramp-east-up') {
    applyEastWestRamp(levels, ROAD_CENTER, 2, 3);
  } else if (id === 'road-ramp-east-down') {
    applyEastWestRamp(levels, ROAD_CENTER, 3, 2);
  }

  const snapshot = createSnapshot(levels, 2000 + ROAD_FIXTURE_IDS.indexOf(id));
  const waterResult = deriveWaterSnapshot(snapshot, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(`terrain-lab:road-water:${waterResult.error.code}`);
  const water = waterResult.value;
  const environment = createFixtureRoadEnvironment(snapshot, water);
  const empty = createEmptyRoadSnapshot(WORLD_CONFIG);
  const plan = planRoadMutation(
    empty,
    {
      operation: 'build',
      definitionId: 'basic-road',
      cells: cellsForRoadFixture(id),
    },
    environment,
    WORLD_CONFIG,
  );

  let roads = empty;
  if (plan.valid) roads = commitRoadMutation(empty, plan, environment, WORLD_CONFIG).snapshot;
  const focusCell =
    id === 'road-invalid-wet'
      ? Object.freeze({ x: ROAD_CENTER.x, z: WORLD_CONFIG.mapHeight - 1 })
      : id === 'road-chunk-boundary'
        ? Object.freeze({ x: 16, z: ROAD_CENTER.z })
        : ROAD_CENTER;
  const connectionMask = plan.valid
    ? roadConnectionMaskAt(roads, focusCell, environment, WORLD_CONFIG)
    : 0;

  return Object.freeze({
    id,
    name: id,
    snapshot,
    water,
    road: Object.freeze({
      roads,
      environment,
      plan,
      focusCell,
      valid: plan.valid,
      invalidReason: plan.invalidReason,
      connectionMask,
    }),
  });
}

function isDiagnosticShape(value: string | null): value is DiagnosticShapeId {
  return value !== null && DIAGNOSTIC_SHAPES.has(value as DiagnosticShapeId);
}

function isWaterFixture(value: string | null): value is WaterFixtureName {
  return value !== null && WATER_FIXTURE_NAMES.includes(value as WaterFixtureName);
}

function isRoadFixture(value: string | null): value is RoadFixtureId {
  return value !== null && ROAD_FIXTURE_SET.has(value as RoadFixtureId);
}

export function resolveFixture(input: string | null, shape: string | null = null): TerrainFixture {
  if (isRoadFixture(input)) return createRoadFixture(input);
  if (isWaterFixture(input)) {
    const fixture = createWaterFixture(input);
    return { id: input, name: input, snapshot: fixture.terrain };
  }

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
