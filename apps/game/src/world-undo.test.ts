import {
  BASIC_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
} from '@web-three-city/road-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { WorldUndoStore } from './world-undo.js';

const LATTICE_LENGTH = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);

function terrain(revision: number, level = 2) {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(LATTICE_LENGTH).fill(level),
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  });
}

function roads(revision: number, x: number, z: number) {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  codes[z * WORLD_CONFIG.mapWidth + x] = BASIC_ROAD_CODE;
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

describe('WorldUndoStore', () => {
  it('replaces the single slot with the latest tagged mutation', () => {
    const store = new WorldUndoStore(WORLD_CONFIG);
    store.replace({ kind: 'terraform', terrain: terrain(2) });
    expect(store.available).toBe(true);
    expect(store.kind).toBe('terraform');

    store.replace({ kind: 'road', roads: roads(4, 3, 3) });
    expect(store.available).toBe(true);
    expect(store.kind).toBe('road');
    expect(store.consume()).toMatchObject({ kind: 'road', roads: { revision: 6 } });
    expect(store.available).toBe(false);
    expect(store.kind).toBeNull();
    expect(store.consume()).toBeNull();
  });

  it('defensively copies Terrain bytes and restores through a newer revision', () => {
    const original = terrain(5, 2);
    const store = new WorldUndoStore(WORLD_CONFIG);
    store.replace({ kind: 'terraform', terrain: original });

    original.heightLevels[0] = 4;
    const entry = store.consume();
    expect(entry?.kind).toBe('terraform');
    if (entry?.kind !== 'terraform') return;
    expect(entry.terrain.revision).toBe(7);
    expect(entry.terrain.heightLevels[0]).toBe(2);
    entry.terrain.heightLevels[0] = 0;
    expect(original.heightLevels[0]).toBe(4);
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('defensively copies Road bytes and restores through a newer revision', () => {
    const original = roads(7, 6, 8);
    const store = new WorldUndoStore(WORLD_CONFIG);
    store.replace({ kind: 'road', roads: original });

    const exposed = original.definitionCodes;
    exposed[8 * WORLD_CONFIG.mapWidth + 6] = 0;
    const entry = store.consume();
    expect(entry?.kind).toBe('road');
    if (entry?.kind !== 'road') return;
    expect(entry.roads.revision).toBe(9);
    expect(entry.roads.definitionCodes[8 * WORLD_CONFIG.mapWidth + 6]).toBe(BASIC_ROAD_CODE);
  });

  it('clears the slot on load and leaves an existing entry untouched when no replacement occurs', () => {
    const store = new WorldUndoStore(WORLD_CONFIG);
    store.replace({ kind: 'road', roads: createEmptyRoadSnapshot(WORLD_CONFIG) });

    const operationSucceeded = false;
    if (operationSucceeded) {
      store.replace({ kind: 'terraform', terrain: terrain(9) });
    }
    expect(store.kind).toBe('road');

    store.clear();
    expect(store.available).toBe(false);
    expect(store.kind).toBeNull();
    expect(store.consume()).toBeNull();
  });
});
