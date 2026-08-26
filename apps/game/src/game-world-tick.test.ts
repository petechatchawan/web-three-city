import {
  addGameMinutes,
  gameMinuteDuration,
  gameMinuteValue,
} from '@web-three-city/simulation-core';
import {
  createEmptyBuildingSnapshot,
  type BuildingDevelopmentEnvironment,
} from '@web-three-city/building-core';
import { createFoundationRciRegistries, createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import {
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
  deriveMacroHourIndex,
  macroHourIndex,
} from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  commitGameWorldTick,
  planGameWorldTick,
  requiresMobilityTrafficSourceDerivation,
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

function initialState(absoluteTick = 8) {
  const simulation =
    absoluteTick === 8
      ? createInitialSimulationSnapshot()
      : createSimulationSnapshot({
          revision: absoluteTick * 60 - 480,
          absoluteGameMinute: absoluteTick * 60,
          growthSequence: 0,
        });
  return Object.freeze({
    revision: 0,
    simulation,
    buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
    rci: createInitialRciSnapshot({
      absoluteMacroHourIndex: deriveMacroHourIndex(simulation.absoluteGameMinute),
      deterministicSeed: 41,
    }),
    roads: createEmptyRoadSnapshot(WORLD_CONFIG),
    economy: createInitialEconomySnapshot(
      {
        year: 1,
        month: 1,
        latestDailySettlementTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
      },
      FOUNDATION_ECONOMY_RULES,
    ),
  });
}

describe('atomic game-world tick', () => {
  it('stages one eligible Economy settlement in the same atomic tick candidate', () => {
    const base = Object.freeze({
      ...initialState(),
      simulation: createSimulationSnapshot({
        revision: 59,
        absoluteGameMinute: 479,
        growthSequence: 0,
      }),
      rci: createInitialRciSnapshot({
        absoluteMacroHourIndex: macroHourIndex(7),
        deterministicSeed: 41,
      }),
      economy: createInitialEconomySnapshot(
        { year: 1, month: 1, latestDailySettlementTick: 7 },
        FOUNDATION_ECONOMY_RULES,
      ),
    });
    const state = Object.freeze({
      ...base,
      economy: Object.freeze({
        ...base.economy,
        taxPolicy: Object.freeze({ ...base.economy.taxPolicy, residentialBp: 200 }),
      }),
    });
    const plan = planGameWorldTick({
      state,
      environment,
      config: WORLD_CONFIG,
      registries: createFoundationRciRegistries(),
    });
    expect(plan.valid).toBe(true);
    expect(plan.proposedState.simulation.absoluteGameMinute).toBe(8 * 60);
    expect(plan.proposedState.economy.lastDailySettlementTick).toBe(8);
    expect(plan.proposedState.economy.revision).toBe(1);
    expect(plan.rciReceipt.afterAbsoluteMacroHourIndex).toBe(macroHourIndex(8));
    expect(plan.rciReceipt).toBeDefined();
    expect(plan.rciDemandContributions).toContainEqual(
      expect.objectContaining({
        factorDefinitionId: 'economy.tax.residential.v1',
        channel: 'residential',
        valueMilli: expect.any(Number),
      }),
    );
    expect(
      plan.rciDemandContributions.find(
        (contribution) => contribution.factorDefinitionId === 'economy.tax.residential.v1',
      )?.valueMilli,
    ).toBeGreaterThan(0);
    expect(plan.proposedState.economy.taxPolicy.residentialBp).toBe(200);
  });

  it('plans deterministically and advances Simulation/RCI through one proposed world state', () => {
    const registries = createFoundationRciRegistries();
    const state = initialState();
    const first = planGameWorldTick({ state, environment, config: WORLD_CONFIG, registries });
    const second = planGameWorldTick({ state, environment, config: WORLD_CONFIG, registries });
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
    expect(first.proposedState.revision).toBe(1);
    expect(gameMinuteValue(first.proposedState.simulation.absoluteGameMinute)).toBe(
      gameMinuteValue(addGameMinutes(state.simulation.absoluteGameMinute, gameMinuteDuration(1))),
    );
    expect(first.proposedState.buildings).toBe(state.buildings);
  });

  it('skips expensive Traffic source derivation when no Mobility or Traffic work exists', () => {
    const state = new GameWorldStateStore(initialState()).snapshot();
    expect(
      requiresMobilityTrafficSourceDerivation({
        citizenCount: 0,
        mobility: state.mobility,
        traffic: state.traffic,
      }),
    ).toBe(false);
    expect(
      requiresMobilityTrafficSourceDerivation({
        citizenCount: 1,
        mobility: state.mobility,
        traffic: state.traffic,
      }),
    ).toBe(true);
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
    const committedBefore = store.snapshot();
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
    expect(store.snapshot()).toBe(committedBefore);
  });
});
