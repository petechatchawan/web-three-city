import {
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
} from '@web-three-city/simulation-core';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import { CommittedWorldStore, createCommittedWorld } from './application/committed-world.js';
import { DefaultWorldTransactionCoordinator } from './application/world-transaction-coordinator.js';
import {
  executeGameMinuteTransaction,
  planGameMinuteTransaction,
} from './game-minute-transaction.js';

function worldAtMinute(absoluteGameMinute: number) {
  const base = createApplicationFixture();
  return createCommittedWorld({
    ...base,
    simulation: createSimulationSnapshot({
      revision: absoluteGameMinute - createInitialSimulationSnapshot().absoluteGameMinute,
      absoluteGameMinute,
      growthSequence: base.simulation.growthSequence,
    }),
  });
}

describe('Game minute transaction', () => {
  it('advances a non-hour minute without running macro consumers', () => {
    const before = worldAtMinute(8 * 60 + 1);
    const plan = planGameMinuteTransaction({
      world: before,
      registries: createFoundationRciRegistries(),
    });

    expect(plan.valid).toBe(true);
    expect(plan.nextWorld.simulation.absoluteGameMinute).toBe(8 * 60 + 2);
    expect(plan.nextWorld.buildings.revision).toBe(before.buildings.revision);
    expect(plan.nextWorld.rci.revision).toBe(before.rci.revision);
    expect(plan.nextWorld.economy.revision).toBe(before.economy.revision);
    expect((plan.nextWorld.traffic as unknown as { schemaVersion: number }).schemaVersion).toBe(2);
    expect(
      (plan.nextWorld.traffic as unknown as { timeCursor: { sourceGameMinute: number } }).timeCursor
        .sourceGameMinute,
    ).toBe(8 * 60 + 2);
  });

  it('runs macro consumers once when 08:59 advances to 09:00', () => {
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(worldAtMinute(8 * 60 + 59)),
    });

    const plan = planGameMinuteTransaction({
      world: coordinator.snapshot(),
      registries: createFoundationRciRegistries(),
    });
    const committed = executeGameMinuteTransaction({
      coordinator,
      registries: createFoundationRciRegistries(),
    });

    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;
    expect(committed.world.simulation.absoluteGameMinute).toBe(9 * 60);
    expect(committed.world.simulation.revision).toBe(60);
    expect(plan.rciReceipt).toMatchObject({ beforeAbsoluteTick: 8, afterAbsoluteTick: 9 });
  });
});
