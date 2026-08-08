import {
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import type {
  WorldPublicationResult,
  WorldTransactionCoordinator,
} from './world-transaction-coordinator.js';
import { FOUNDATION_ECONOMY_RULES } from '@web-three-city/economy-core';
import { refundPaidActionCost, type PaidActionReceipt } from './economy-action-cost.js';

export type WorldUndoKind = 'terraform' | 'road' | 'zone' | 'building';

export class UndoCoordinator {
  readonly #transactionCoordinator: WorldTransactionCoordinator;
  #beforeWorld: CommittedWorld | null = null;
  #kind: WorldUndoKind | null = null;
  #payment: PaidActionReceipt | null = null;

  constructor(input: { transactionCoordinator: WorldTransactionCoordinator }) {
    this.#transactionCoordinator = input.transactionCoordinator;
  }

  get available(): boolean {
    return this.#beforeWorld !== null;
  }

  get kind(): WorldUndoKind | null {
    return this.#kind;
  }

  record(
    world: CommittedWorld,
    kind: WorldUndoKind = 'building',
    payment: PaidActionReceipt | null = null,
  ): void {
    this.#beforeWorld = createCommittedWorld(world);
    this.#kind = kind;
    this.#payment = payment;
  }

  clear(): void {
    this.#beforeWorld = null;
    this.#kind = null;
    this.#payment = null;
  }

  undo(): WorldPublicationResult | null {
    if (this.#beforeWorld === null) return null;
    const before = this.#beforeWorld;
    const current = this.#transactionCoordinator.snapshot();
    const refund =
      this.#payment === null
        ? { ok: true as const, snapshot: current.economy }
        : refundPaidActionCost(current.economy, this.#payment, FOUNDATION_ECONOMY_RULES);
    if (!refund.ok) return null;
    const kind = this.#kind;
    const candidate = createCommittedWorldFromDomainState({
      revision: current.revision + 1,
      terrain: kind === 'terraform' ? before.terrain : current.terrain,
      roads: kind === 'road' ? before.roads : current.roads,
      zones: kind === 'zone' ? before.zones : current.zones,
      buildings: kind === 'building' ? before.buildings : current.buildings,
      simulation: current.simulation,
      rci: kind === 'building' ? before.rci : current.rci,
      economy: refund.snapshot,
    });
    const result = this.#transactionCoordinator.publish({
      baseRevision: current.revision,
      baseFingerprint: fingerprintCommittedWorld(current),
      nextWorld: candidate,
      nextFingerprint: fingerprintCommittedWorld(candidate),
    });
    if (result.status === 'committed') this.clear();
    return result;
  }
}
