import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { createFoundationRciRegistries, createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createSimulationSnapshot, macroHourIndex } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import { createCommittedWorldFromDomainState } from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { planGameWorldTick } from './game-world-tick.js';
import {
  createGameWorldState,
  type GameWorldState,
  type GameWorldStateInput,
} from './game-world-state.js';
import { decodeWorldSave, encodeWorldSaveV6 } from './world-save.js';

describe('Economy save continuation determinism', () => {
  it('matches uninterrupted execution across cycle settlement and compressed period close', () => {
    const base = createApplicationFixture();
    const simulation = createSimulationSnapshot({
      revision: 719,
      absoluteGameMinute: 727 * 60,
      growthSequence: 0,
    });
    const state: GameWorldStateInput = Object.freeze({
      revision: 0,
      simulation,
      buildings: base.buildings,
      roads: base.roads,
      rci: createInitialRciSnapshot({
        absoluteMacroHourIndex: macroHourIndex(727),
        deterministicSeed: 41,
      }),
      economy: createInitialEconomySnapshot(
        { year: 3, month: 6, latestCycleSettlementAtMacroHourIndex: macroHourIndex(704) },
        FOUNDATION_ECONOMY_RULES,
      ),
    });
    const registries = createFoundationRciRegistries();
    const step = (current: GameWorldStateInput): GameWorldState => {
      const plan = planGameWorldTick({
        state: current,
        environment: base.environments.building,
        config: WORLD_CONFIG,
        registries,
      });
      expect(plan.valid).toBe(true);
      return plan.proposedState;
    };
    const advanceHour = (start: GameWorldStateInput): GameWorldState => {
      let current = createGameWorldState(start);
      for (let index = 0; index < 60; index += 1) current = step(current);
      return current;
    };
    const atBoundary = advanceHour(state);
    const uninterrupted = step(atBoundary);

    const saved = encodeWorldSaveV6(
      base.terrain,
      base.roads,
      base.zones,
      atBoundary.buildings,
      atBoundary.simulation,
      atBoundary.rci,
      atBoundary.economy,
    );
    const decoded = decodeWorldSave(saved, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const resumed = step(
      Object.freeze({
        revision: atBoundary.revision,
        simulation: decoded.value.simulation,
        buildings: decoded.value.buildings,
        roads: decoded.value.roads,
        rci: decoded.value.rci,
        economy: decoded.value.economy,
      }),
    );
    expect(resumed.rci).toEqual(uninterrupted.rci);
    expect(resumed.economy).toEqual(uninterrupted.economy);

    const committed = (final: GameWorldState) =>
      createCommittedWorldFromDomainState({
        revision: final.revision,
        terrain: base.terrain,
        roads: final.roads,
        zones: base.zones,
        buildings: final.buildings,
        simulation: final.simulation,
        rci: final.rci,
        economy: final.economy,
      });
    expect(fingerprintCommittedWorld(committed(resumed))).toBe(
      fingerprintCommittedWorld(committed(uninterrupted)),
    );
  });
});
