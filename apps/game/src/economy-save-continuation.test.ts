import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { createFoundationRciRegistries, createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createSimulationSnapshot } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import { createCommittedWorldFromDomainState } from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { planGameWorldTick } from './game-world-tick.js';
import type { GameWorldState } from './game-world-state.js';
import { decodeWorldSave, encodeWorldSaveV6 } from './world-save.js';

describe('Economy save continuation determinism', () => {
  it('matches uninterrupted execution across daily settlement and monthly close', () => {
    const base = createApplicationFixture();
    const simulation = createSimulationSnapshot({
      revision: 719,
      absoluteTick: 727,
      growthSequence: 0,
    });
    const state: GameWorldState = Object.freeze({
      revision: 0,
      simulation,
      buildings: base.buildings,
      roads: base.roads,
      rci: createInitialRciSnapshot({ absoluteTick: 727, deterministicSeed: 41 }),
      economy: createInitialEconomySnapshot(
        { year: 1, month: 1, latestDailySettlementTick: 704 },
        FOUNDATION_ECONOMY_RULES,
      ),
    });
    const registries = createFoundationRciRegistries();
    const step = (current: GameWorldState) => {
      const plan = planGameWorldTick({
        state: current,
        environment: base.environments.building,
        config: WORLD_CONFIG,
        registries,
      });
      expect(plan.valid).toBe(true);
      return plan.proposedState;
    };
    const atBoundary = step(state);
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
