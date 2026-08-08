import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { describe, expect, it } from 'vitest';
import { GameWorldStateStore, gameWorldStateFromCommittedWorld } from './game-world-state.js';

function initialState() {
  const simulation = createInitialSimulationSnapshot();
  return Object.freeze({
    revision: 0,
    simulation,
    buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
    rci: createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick }),
    roads: createEmptyRoadSnapshot(WORLD_CONFIG),
    economy: createInitialEconomySnapshot(
      { year: 1, month: 1, latestDailySettlementTick: simulation.absoluteTick },
      FOUNDATION_ECONOMY_RULES,
    ),
  });
}

describe('GameWorldStateStore', () => {
  it('projects a committed world through the legacy compatibility shape', () => {
    const legacy = initialState();
    const committed = { ...legacy, revision: 4 } as Parameters<
      typeof gameWorldStateFromCommittedWorld
    >[0];
    expect(gameWorldStateFromCommittedWorld(committed)).toEqual({
      revision: 4,
      simulation: legacy.simulation,
      buildings: legacy.buildings,
      rci: legacy.rci,
      roads: legacy.roads,
      economy: legacy.economy,
    });
  });

  it('publishes Simulation, Buildings, and RCI in one revision replacement', () => {
    const store = new GameWorldStateStore(initialState());
    const before = store.snapshot();
    const next = Object.freeze({
      revision: 1,
      simulation: Object.freeze({
        ...before.simulation,
        revision: 1,
        absoluteTick: before.simulation.absoluteTick + 1,
      }),
      buildings: before.buildings,
      rci: before.rci,
      roads: before.roads,
      economy: before.economy,
    });
    expect(store.replace(0, next)).toBe(next);
    expect(store.snapshot()).toBe(next);
  });

  it('rejects stale and non-contiguous replacements without partial publication', () => {
    const store = new GameWorldStateStore(initialState());
    const before = store.snapshot();
    expect(() => store.replace(1, { ...before, revision: 2 })).toThrow(
      'game-world-state:stale-revision',
    );
    expect(() => store.replace(0, { ...before, revision: 2 })).toThrow(
      'game-world-state:invalid-next-revision',
    );
    expect(store.snapshot()).toBe(before);
  });

  it('synchronizes explicit external snapshots as one new world revision', () => {
    const store = new GameWorldStateStore(initialState());
    const before = store.snapshot();
    const simulation = Object.freeze({
      ...before.simulation,
      revision: before.simulation.revision + 1,
      absoluteTick: before.simulation.absoluteTick + 1,
    });
    const synchronized = store.synchronizeExternal({
      simulation,
      buildings: before.buildings,
      rci: before.rci,
    });
    expect(synchronized.revision).toBe(1);
    expect(synchronized.simulation).toBe(simulation);
    expect(
      store.synchronizeExternal({ simulation, buildings: before.buildings, rci: before.rci }),
    ).toBe(synchronized);
  });
});
