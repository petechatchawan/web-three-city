import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import {
  createTerrainMap,
  type TerrainSnapshot,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it, vi } from 'vitest';
import {
  createTerraformStrokeSession,
  type TerraformStrokeRelease,
} from './terraform-stroke-session.js';

const LATTICE_LENGTH = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function flatTerrain(level = 2): TerrainSnapshot {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_LENGTH).fill(level),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 4,
  });
}

function roadsAt(...cells: readonly CellCoord[]): RoadSnapshot {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  for (const cell of cells) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = BASIC_ROAD_CODE;
  return createRoadSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 2,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function createSession(terrain = flatTerrain(), roads = createEmptyRoadSnapshot(WORLD_CONFIG)) {
  const onState = vi.fn();
  return {
    terrain,
    onState,
    session: createTerraformStrokeSession({
      config: WORLD_CONFIG,
      getTerrainSnapshot: () => terrain,
      getRoadSnapshot: () => roads,
      onState,
    }),
  };
}

function maxDeltaFromBaseline(plan: TerraformPlan, baseline: TerrainSnapshot): number {
  let maximum = 0;
  for (let index = 0; index < baseline.heightLevels.length; index += 1) {
    maximum = Math.max(
      maximum,
      Math.abs(plan.proposedHeightLevels[index]! - baseline.heightLevels[index]!),
    );
  }
  return maximum;
}

function expectCommit(release: TerraformStrokeRelease): TerraformPlan {
  expect(release.kind).toBe('commit');
  if (release.kind !== 'commit') throw new Error(`expected commit, received ${release.kind}`);
  return release.plan;
}

describe('TerraformStrokeSession', () => {
  it('preserves accepted stamps when a later stamp is rejected', () => {
    const { session } = createSession(flatTerrain(), roadsAt({ x: 4, z: 2 }));

    expect(session.begin(1, 'raise', 1, { x: 1, z: 2 })).toBe(true);
    session.move(1, { x: 4, z: 2 });

    const state = session.getState();
    expect(state.acceptedAnchors).toContainEqual({ x: 1, z: 2 });
    expect(state.currentStamp).toMatchObject({
      kind: 'rejected',
      reason: 'terraform:road-occupied',
      anchor: { x: 4, z: 2 },
    });
    expect(state.acceptedPlan?.valid).toBe(true);
  });

  it('accepts later valid stamps after a rejected stamp', () => {
    const { session } = createSession(flatTerrain(), roadsAt({ x: 3, z: 2 }));

    session.begin(1, 'raise', 1, { x: 1, z: 2 });
    session.move(1, { x: 3, z: 2 });
    session.move(1, { x: 5, z: 2 });

    expect(session.getState().acceptedAnchors).toEqual([
      { x: 1, z: 2 },
      { x: 2, z: 2 },
      { x: 4, z: 2 },
      { x: 5, z: 2 },
    ]);
    expect(session.getState().currentStamp).toMatchObject({
      kind: 'accepted',
      anchor: { x: 5, z: 2 },
    });
  });

  it('does not compound a revisited anchor', () => {
    const { session, terrain } = createSession();

    session.begin(7, 'raise', 1, { x: 2, z: 2 });
    session.move(7, { x: 3, z: 2 });
    session.move(7, { x: 2, z: 2 });
    const plan = expectCommit(session.end(7, { x: 2, z: 2 }));

    expect(maxDeltaFromBaseline(plan, terrain)).toBe(1);
    expect(plan.coreCells).toEqual([
      { x: 2, z: 2 },
      { x: 3, z: 2 },
    ]);
  });

  it('commits the last accepted candidate when the current stamp is rejected', () => {
    const { session } = createSession(flatTerrain(), roadsAt({ x: 4, z: 2 }));

    session.begin(1, 'raise', 1, { x: 1, z: 2 });
    session.move(1, { x: 4, z: 2 });
    const plan = expectCommit(session.end(1, { x: 4, z: 2 }));

    expect(plan.coreCells).toEqual([
      { x: 1, z: 2 },
      { x: 2, z: 2 },
      { x: 3, z: 2 },
    ]);
  });

  it('returns no commit after second-pointer cancellation', () => {
    const { session } = createSession();

    session.begin(1, 'raise', 1, { x: 1, z: 1 });
    session.cancelAll();

    expect(session.end(1, { x: 2, z: 1 })).toEqual({ kind: 'ignored' });
    expect(session.getState()).toMatchObject({
      operation: null,
      strokeActive: false,
      currentStamp: { kind: 'none' },
    });
  });

  it('captures Terrain and Road snapshots once at pointer-down', () => {
    let terrain = flatTerrain(2);
    let roads = createEmptyRoadSnapshot(WORLD_CONFIG);
    const session = createTerraformStrokeSession({
      config: WORLD_CONFIG,
      getTerrainSnapshot: () => terrain,
      getRoadSnapshot: () => roads,
      onState: () => undefined,
    });

    session.begin(1, 'raise', 1, { x: 1, z: 1 });
    terrain = flatTerrain(4);
    roads = roadsAt({ x: 2, z: 1 });
    session.move(1, { x: 2, z: 1 });
    const plan = expectCommit(session.end(1, { x: 2, z: 1 }));

    expect(plan.baseTerrainRevision).toBe(4);
    expect(plan.proposedHeightLevels.every((level) => level <= 3)).toBe(true);
  });

  it('reports a no-change Flatten without accepting an anchor', () => {
    const { session } = createSession(flatTerrain(2));

    session.begin(1, 'flatten', 1, { x: 2, z: 2 }, 2);

    expect(session.getState()).toMatchObject({
      acceptedAnchors: [],
      acceptedPlan: null,
      currentStamp: { kind: 'no-change', anchor: { x: 2, z: 2 } },
    });
    expect(session.end(1, { x: 2, z: 2 })).toEqual({ kind: 'no-change' });
  });

  it('keeps session state immutable at API boundaries', () => {
    const { session, onState } = createSession();
    session.begin(1, 'raise', 1, { x: 1, z: 1 });

    const first = session.getState();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.acceptedAnchors)).toBe(true);
    expect(Object.isFrozen(first.acceptedAnchors[0])).toBe(true);
    expect(onState).toHaveBeenCalled();
  });
});
