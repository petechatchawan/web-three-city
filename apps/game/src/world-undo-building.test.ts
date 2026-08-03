import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { WorldUndoStore } from './world-undo.js';

describe('Building Undo', () => {
  it('restores a defensive Building snapshot with a newer revision once', () => {
    const store = new WorldUndoStore(WORLD_CONFIG);
    const snapshot = createBuildingSnapshot({ revision: 3, instances: [] }, WORLD_CONFIG);
    store.replace({ kind: 'building', buildings: snapshot });
    const restored = store.consume();
    expect(restored?.kind).toBe('building');
    if (restored?.kind === 'building') expect(restored.buildings.revision).toBe(5);
    expect(store.consume()).toBeNull();
  });
});
