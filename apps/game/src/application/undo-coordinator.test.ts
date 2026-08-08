import { describe, expect, it } from 'vitest';
import { FOUNDATION_ECONOMY_RULES } from '@web-three-city/economy-core';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { UndoCoordinator } from './undo-coordinator.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';
import { applyPaidActionCost } from './economy-action-cost.js';
import { createCommittedWorldFromDomainState } from './committed-world.js';

describe('UndoCoordinator', () => {
  it('restores complete dependent Building and RCI state while advancing only application revision', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const store = new CommittedWorldStore(before);
    const transactionCoordinator = new DefaultWorldTransactionCoordinator({ worldStore: store });
    const undo = new UndoCoordinator({ transactionCoordinator });
    undo.record(before);
    const removed = createApplicationFixture({ applicationRevision: 1 });
    expect(
      transactionCoordinator.publish({
        baseRevision: before.revision,
        baseFingerprint: fingerprintCommittedWorld(before),
        nextWorld: removed,
        nextFingerprint: fingerprintCommittedWorld(removed),
      }).status,
    ).toBe('committed');

    const result = undo.undo();
    expect(result?.status).toBe('committed');
    if (result?.status === 'committed') {
      expect(result.world.revision).toBe(2);
      expect(result.world.buildings).toEqual(before.buildings);
      expect(result.world.rci).toEqual(before.rci);
      expect(result.world.rci.sequences).toEqual(before.rci.sequences);
    }
    expect(undo.available).toBe(false);
  });

  it('retains the pending entry when publication is rejected', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const transactionCoordinator = {
      snapshot: () => before,
      publish: () => ({
        status: 'rejected' as const,
        world: before,
        reason: 'world:stale-content' as const,
      }),
      replaceFromDecodedWorld: () => ({
        status: 'rejected' as const,
        world: before,
        reason: 'world:stale-content' as const,
      }),
    };
    const undo = new UndoCoordinator({ transactionCoordinator });
    undo.record(before);

    expect(undo.undo()?.status).toBe('rejected');
    expect(undo.available).toBe(true);
  });

  it('refunds the exact paid delta while preserving later Economy changes and prevents double refund', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const payment = applyPaidActionCost(
      before.economy,
      { category: 'bulldoze', totalMinor: 10_000 },
      FOUNDATION_ECONOMY_RULES,
    );
    expect(payment.ok).toBe(true);
    if (!payment.ok) return;
    const removed = createApplicationFixture({ applicationRevision: 1 });
    const paidWorld = createCommittedWorldFromDomainState({
      revision: 1,
      terrain: removed.terrain,
      roads: removed.roads,
      zones: removed.zones,
      buildings: removed.buildings,
      simulation: removed.simulation,
      rci: removed.rci,
      economy: {
        ...payment.snapshot,
        treasuryBalanceMinor: payment.snapshot.treasuryBalanceMinor + 500,
      },
    });
    expect(
      coordinator.publish({
        baseRevision: 0,
        baseFingerprint: fingerprintCommittedWorld(before),
        nextWorld: paidWorld,
        nextFingerprint: fingerprintCommittedWorld(paidWorld),
      }).status,
    ).toBe('committed');
    const undo = new UndoCoordinator({ transactionCoordinator: coordinator });
    undo.record(before, 'building', payment.receipt);
    const result = undo.undo();
    expect(result?.status).toBe('committed');
    if (result?.status === 'committed') {
      expect(result.world.economy.treasuryBalanceMinor).toBe(
        before.economy.treasuryBalanceMinor + 500,
      );
      expect(result.world.economy.currentPeriod.refundsMinor).toBe(10_000);
    }
    expect(undo.undo()).toBeNull();
  });
});
