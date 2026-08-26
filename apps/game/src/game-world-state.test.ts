import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import {
  addGameMinutes,
  createInitialSimulationSnapshot,
  gameMinuteDuration,
} from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  GameWorldStateStore,
  gameWorldStateFromCommittedWorld,
  type GameWorldStateInput,
} from './game-world-state.js';

function initialState(): GameWorldStateInput {
  const simulation = createInitialSimulationSnapshot();
  return Object.freeze({
    revision: 0,
    simulation,
    buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
    rci: createInitialRciSnapshot({ absoluteTick: simulation.absoluteGameMinute }),
    roads: createEmptyRoadSnapshot(WORLD_CONFIG),
    economy: createInitialEconomySnapshot(
      { year: 1, month: 1, latestDailySettlementTick: simulation.absoluteGameMinute },
      FOUNDATION_ECONOMY_RULES,
    ),
  });
}

describe('GameWorldStateStore', () => {
  it('projects a committed world through the legacy compatibility shape', () => {
    const normalized = new GameWorldStateStore(initialState()).snapshot();
    const committed = { ...normalized, revision: 4 } as unknown as Parameters<
      typeof gameWorldStateFromCommittedWorld
    >[0];
    expect(gameWorldStateFromCommittedWorld(committed)).toEqual({
      ...normalized,
      revision: 4,
    });
  });

  it('publishes Simulation, Buildings, RCI, Mobility, and Traffic in one revision replacement', () => {
    const store = new GameWorldStateStore(initialState());
    const before = store.snapshot();
    const next = Object.freeze({
      ...before,
      revision: 1,
      simulation: Object.freeze({
        ...before.simulation,
        revision: 1,
        absoluteGameMinute: addGameMinutes(
          before.simulation.absoluteGameMinute,
          gameMinuteDuration(1),
        ),
      }),
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
      absoluteGameMinute: addGameMinutes(
        before.simulation.absoluteGameMinute,
        gameMinuteDuration(1),
      ),
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
    expect(synchronized.mobility).toBe(before.mobility);
    expect(synchronized.traffic).toBe(before.traffic);
  });
});
