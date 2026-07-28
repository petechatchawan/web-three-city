import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  createTerrainMap,
  TerraformUndoStore,
  type TerrainSnapshot,
} from '../src/index.js';

function terrain(level: number, revision: number, seed = 23): TerrainSnapshot {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(
      (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1),
    ).fill(level),
    seed,
    generatorVersion: 'coastal-v1',
    generationAttempt: 2,
    revision,
  });
}

describe('TerraformUndoStore', () => {
  it('starts empty and clears idempotently', () => {
    const store = new TerraformUndoStore();
    expect(store.available).toBe(false);
    expect(store.undo(terrain(1, 1), WORLD_CONFIG)).toBeNull();
    store.clear();
    store.clear();
    expect(store.available).toBe(false);
  });

  it('restores captured bytes with a newer revision and consumes Undo', () => {
    const before = terrain(1, 3);
    const after = terrain(2, 4);
    const store = new TerraformUndoStore();
    store.captureBeforeCommit(before);

    const restored = store.undo(after, WORLD_CONFIG);

    expect(restored?.heightLevels).toEqual(before.heightLevels);
    expect(restored?.heightLevels).not.toBe(before.heightLevels);
    expect(restored?.revision).toBe(5);
    expect(restored?.seed).toBe(before.seed);
    expect(restored?.generationAttempt).toBe(before.generationAttempt);
    expect(store.available).toBe(false);
    expect(store.undo(restored!, WORLD_CONFIG)).toBeNull();
  });

  it('a later capture replaces the previous Undo entry', () => {
    const store = new TerraformUndoStore();
    store.captureBeforeCommit(terrain(1, 1, 31));
    store.captureBeforeCommit(terrain(2, 2, 37));

    const restored = store.undo(terrain(3, 3, 41), WORLD_CONFIG);

    expect(restored?.heightLevels[0]).toBe(2);
    expect(restored?.seed).toBe(37);
    expect(restored?.revision).toBe(4);
  });

  it('copies captured bytes so later external mutation cannot alter Undo', () => {
    const before = terrain(1, 1);
    const store = new TerraformUndoStore();
    store.captureBeforeCommit(before);
    before.heightLevels[0] = 4;

    expect(store.undo(terrain(2, 2), WORLD_CONFIG)?.heightLevels[0]).toBe(1);
  });
});
