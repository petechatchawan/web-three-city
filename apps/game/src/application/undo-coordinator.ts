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

export type WorldUndoKind = 'terraform' | 'road' | 'zone' | 'building';

export class UndoCoordinator {
  readonly #transactionCoordinator: WorldTransactionCoordinator;
  #beforeWorld: CommittedWorld | null = null;
  #kind: WorldUndoKind | null = null;

  constructor(input: { transactionCoordinator: WorldTransactionCoordinator }) {
    this.#transactionCoordinator = input.transactionCoordinator;
  }

  get available(): boolean {
    return this.#beforeWorld !== null;
  }

  get kind(): WorldUndoKind | null {
    return this.#kind;
  }

  record(world: CommittedWorld, kind: WorldUndoKind = 'building'): void {
    this.#beforeWorld = createCommittedWorld(world);
    this.#kind = kind;
  }

  clear(): void {
    this.#beforeWorld = null;
    this.#kind = null;
  }

  undo(): WorldPublicationResult | null {
    if (this.#beforeWorld === null) return null;
    const before = this.#beforeWorld;
    const current = this.#transactionCoordinator.snapshot();
    const candidate = createCommittedWorldFromDomainState({
      revision: current.revision + 1,
      terrain: before.terrain,
      roads: before.roads,
      zones: before.zones,
      buildings: before.buildings,
      simulation: before.simulation,
      rci: before.rci,
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
