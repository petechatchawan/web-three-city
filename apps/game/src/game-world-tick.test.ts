import {
  createEmptyBuildingSnapshot,
  type BuildingDevelopmentEnvironment,
} from '@web-three-city/building-core';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
} from '@web-three-city/rci-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  commitGameWorldTick,
  planGameWorldTick,
} from './game-world-tick.js';
import { GameWorldStateStore } from './game-world-state.js';

const environment = Object.freeze({
  terrainRevision: 0,
  waterSourceTerrainRevision: 0,
  roadRevision: 0,
  zoneRevision: 0,
  surfaceAt: () => ({ shape: 'flat' }) as never,
  isDry: () => true,
  isRoadOccupied: () => false,
  zoneDefinitionIdAt: () => null,
  roadAccessAt: () => null,
}) as BuildingDevelopmentEnvironment;

function initialState() {
  const simulation = createInitialSimulationSnapshot();
  return Object.freeze({
    revision: 0,
    simulation,
    buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
    rci: createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick, deterministicSeed: 41 }),
  });
}

describe('atomic game-world tick', () => {
  it('plans deterministically and advances Simulation/RCI through one proposed world state', () => {
    const registries = createFoundationRciRegistries();
    const state = initialState();
    const first = planGameWorldTick({ state, environment, config: WORLD_CONFIG, registries });
    const second = planGameWorldTick({ state, environment, config: WORLD_CONFIG, registries });
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
    expect(first.proposedState.revision).toBe(1);
    expect(first.proposedState.simulation.absoluteTick).toBe(state.simulation.absoluteTick + 1);
    expect(first.proposedState.buildings).toBe(state.buildings);
  });

  it('publishes a valid plan once and rejects stale replay without partial state', () => {
    const store = new GameWorldStateStore(initialState());
    const plan = planGameWorldTick({
      state: store.snapshot(),
      environment,
      config: WORLD_CONFIG,
      registries: createFoundationRciRegistries(),
    });
    const committed = commitGameWorldTick(store, plan);
    expect(store.snapshot()).toBe(committed);
    expect(() => commitGameWorldTick(store, plan)).toThrow('game-world-state:stale-revision');
    expect(store.snapshot()).toBe(committed);
  });

  it('does not publish any staged Building or Simulation result when the RCI plan is invalid', () => {
    const state = initialState();
    const store = new GameWorldStateStore(state);
    const invalidEnvironment = {
      ...environment,
      waterSourceTerrainRevision: 1,
    } as BuildingDevelopmentEnvironment;
    const plan = planGameWorldTick({
      state,
      environment: invalidEnvironment,
      config: WORLD_CONFIG,
      registries: createFoundationRciRegistries(),
    });
    expect(plan.valid).toBe(false);
    expect(() => commitGameWorldTick(store, plan)).toThrow('game-world-tick:invalid-plan');
    expect(store.snapshot()).toBe(state);
  });
});
