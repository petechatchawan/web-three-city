import type { TerrainCellSurfaceProfile, TerrainShape } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  BASIC_ROAD_CODE,
  RoadContractError,
  commitRoadMutation,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  planRoadMutation,
  roadOccupiedAt,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
  type RoadStrokeInput,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function profile(cell: CellCoord, shape: TerrainShape = 'flat'): TerrainCellSurfaceProfile {
  const rampNorth = shape === 'ramp-north';
  const rampSouth = shape === 'ramp-south';
  const rampEast = shape === 'ramp-east';
  const rampWest = shape === 'ramp-west';
  const corners = Object.freeze({
    nw: rampNorth || rampWest ? 2 : 1,
    ne: rampNorth || rampEast ? 2 : 1,
    sw: rampSouth || rampWest ? 2 : 1,
    se: rampSouth || rampEast ? 2 : 1,
  });
  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    corners,
    shape,
    minimumLevel: 1,
    maximumLevel: shape === 'flat' ? 1 : 2,
    slopeAxis:
      shape === 'ramp-north' || shape === 'ramp-south'
        ? 'north-south'
        : shape === 'ramp-east' || shape === 'ramp-west'
          ? 'east-west'
          : null,
  });
}

function environment(
  options: {
    readonly terrainRevision?: number;
    readonly waterRevision?: number;
    readonly shapes?: Readonly<Record<string, TerrainShape>>;
    readonly wet?: ReadonlySet<string>;
  } = {},
): RoadPlacementEnvironment {
  const shapes = options.shapes ?? {};
  const wet = options.wet ?? new Set<string>();
  return Object.freeze({
    terrainRevision: options.terrainRevision ?? 7,
    waterSourceTerrainRevision: options.waterRevision ?? options.terrainRevision ?? 7,
    surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
      return profile(cell, shapes[key(cell)] ?? 'flat');
    },
    isDry(cell: CellCoord): boolean {
      return !wet.has(key(cell));
    },
  });
}

function roads(cells: readonly CellCoord[], revision = 2): RoadSnapshot {
  const codes = new Uint8Array(CELL_COUNT);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function build(cells: readonly CellCoord[]): RoadStrokeInput {
  return { operation: 'build', definitionId: 'basic-road', cells };
}

function bulldoze(cells: readonly CellCoord[]): RoadStrokeInput {
  return { operation: 'bulldoze', definitionId: 'basic-road', cells };
}

describe('road mutation planning', () => {
  it('builds an aligned north-south ramp from final transaction occupancy', () => {
    const cells = [
      { x: 5, z: 4 },
      { x: 5, z: 5 },
      { x: 5, z: 6 },
    ];
    const plan = planRoadMutation(
      createEmptyRoadSnapshot(WORLD_CONFIG),
      build(cells.slice().reverse()),
      environment({ shapes: { '5:5': 'ramp-north' } }),
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.invalidReason).toBeNull();
    expect(plan.requestedCells).toEqual(cells);
    expect(plan.addedCells).toEqual(cells);
    expect(plan.removedCells).toEqual([]);
  });

  it('rejects isolated, perpendicular, wet, and unsupported road placement', () => {
    const empty = createEmptyRoadSnapshot(WORLD_CONFIG);

    expect(
      planRoadMutation(
        empty,
        build([{ x: 5, z: 5 }]),
        environment({ shapes: { '5:5': 'ramp-north' } }),
        WORLD_CONFIG,
      ).invalidReason,
    ).toBe('road:invalid-ramp-topology');
    expect(
      planRoadMutation(
        empty,
        build([
          { x: 4, z: 5 },
          { x: 5, z: 5 },
          { x: 6, z: 5 },
        ]),
        environment({ shapes: { '5:5': 'ramp-north' } }),
        WORLD_CONFIG,
      ).invalidReason,
    ).toBe('road:invalid-ramp-topology');
    expect(
      planRoadMutation(
        empty,
        build([{ x: 2, z: 2 }]),
        environment({ wet: new Set(['2:2']) }),
        WORLD_CONFIG,
      ).invalidReason,
    ).toBe('road:wet-cell');
    expect(
      planRoadMutation(
        empty,
        build([{ x: 3, z: 3 }]),
        environment({ shapes: { '3:3': 'diagonal-ridge' } }),
        WORLD_CONFIG,
      ).invalidReason,
    ).toBe('road:unsupported-terrain');
  });

  it('rejects incoherent world revisions and no-op transactions', () => {
    const empty = createEmptyRoadSnapshot(WORLD_CONFIG);
    const incoherent = environment({ terrainRevision: 7, waterRevision: 6 });

    expect(
      planRoadMutation(empty, build([{ x: 1, z: 1 }]), incoherent, WORLD_CONFIG).invalidReason,
    ).toBe('road:incoherent-world-revision');
    expect(
      planRoadMutation(empty, bulldoze([{ x: 1, z: 1 }]), environment(), WORLD_CONFIG),
    ).toMatchObject({ valid: false, invalidReason: 'road:no-change' });
    expect(
      planRoadMutation(
        roads([{ x: 1, z: 1 }]),
        build([{ x: 1, z: 1 }]),
        environment(),
        WORLD_CONFIG,
      ),
    ).toMatchObject({ valid: false, invalidReason: 'road:no-change' });
  });

  it('rejects a bulldoze that would leave a neighboring ramp invalid', () => {
    const original = roads([
      { x: 5, z: 4 },
      { x: 5, z: 5 },
      { x: 5, z: 6 },
    ]);
    const before = original.definitionCodes;
    const plan = planRoadMutation(
      original,
      bulldoze([{ x: 5, z: 4 }]),
      environment({ shapes: { '5:5': 'ramp-north' } }),
      WORLD_CONFIG,
    );

    expect(plan).toMatchObject({ valid: false, invalidReason: 'road:invalid-ramp-topology' });
    expect(original.definitionCodes).toEqual(before);
    expect(roadOccupiedAt(original, { x: 5, z: 4 })).toBe(true);
  });

  it('derives deterministic cross-boundary dirty chunks and topology changes', () => {
    const plan = planRoadMutation(
      createEmptyRoadSnapshot(WORLD_CONFIG),
      build([
        { x: 16, z: 5 },
        { x: 15, z: 5 },
      ]),
      environment(),
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.topologyChangedCells).toEqual([
      { x: 15, z: 5 },
      { x: 16, z: 5 },
    ]);
    expect(plan.dirtyChunks).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]);
  });
});

describe('road mutation commit', () => {
  it('commits exactly once with a frozen deterministic receipt', () => {
    const original = createEmptyRoadSnapshot(WORLD_CONFIG);
    const env = environment();
    const plan = planRoadMutation(original, build([{ x: 1, z: 1 }]), env, WORLD_CONFIG);
    const committed = commitRoadMutation(original, plan, env, WORLD_CONFIG);

    expect(committed.snapshot.revision).toBe(1);
    expect(roadOccupiedAt(committed.snapshot, { x: 1, z: 1 })).toBe(true);
    expect(committed.receipt).toMatchObject({
      beforeRevision: 0,
      afterRevision: 1,
      addedCellCount: 1,
      removedCellCount: 0,
    });
    expect(Object.isFrozen(committed.receipt)).toBe(true);
    expect(Object.isFrozen(committed.receipt.dirtyChunks)).toBe(true);
  });

  it('rejects invalid and stale Road, Terrain, and Water plans', () => {
    const original = createEmptyRoadSnapshot(WORLD_CONFIG);
    const env = environment();
    const plan = planRoadMutation(original, build([{ x: 1, z: 1 }]), env, WORLD_CONFIG);

    expect(() =>
      commitRoadMutation(
        original,
        { ...plan, valid: false, invalidReason: 'road:invalid-state' },
        env,
        WORLD_CONFIG,
      ),
    ).toThrow('road:invalid-plan');
    expect(() =>
      commitRoadMutation(
        createRoadSnapshot(
          {
            width: WORLD_CONFIG.mapWidth,
            height: WORLD_CONFIG.mapHeight,
            revision: 1,
            definitionCodes: original.definitionCodes,
          },
          WORLD_CONFIG,
        ),
        plan,
        env,
        WORLD_CONFIG,
      ),
    ).toThrow('road:stale-road-plan');
    expect(() =>
      commitRoadMutation(original, plan, environment({ terrainRevision: 8 }), WORLD_CONFIG),
    ).toThrow('road:stale-terrain-plan');
    expect(() =>
      commitRoadMutation(
        original,
        plan,
        environment({ terrainRevision: 7, waterRevision: 8 }),
        WORLD_CONFIG,
      ),
    ).toThrow('road:stale-water-plan');
    expect(() => commitRoadMutation(original, plan, env, WORLD_CONFIG)).not.toThrow(
      RoadContractError,
    );
  });
});
